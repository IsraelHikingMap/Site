using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Net;
using System.Net.Http;
using System.Net.Http.Headers;
using System.Text;
using System.Threading.Tasks;
using IsraelHiking.Common;
using IsraelHiking.DataAccessInterfaces;
using OAuth;
using Microsoft.Extensions.Options;
using Microsoft.Extensions.Logging;
using OsmSharp;
using OsmSharp.API;
using OsmSharp.Changesets;
using OsmSharp.Tags;
using OsmSharp.Streams;
using OsmSharp.Streams.Complete;
using OsmSharp.Complete;
using System.Xml.Serialization;
using OsmSharp.IO.Xml;

namespace IsraelHiking.DataAccess.OpenStreetMap
{
    public class OsmGateway : BaseFileFetcherGateway, IOsmGateway
    {
        private readonly TokenAndSecret _tokenAndSecret;
        private readonly ConfigurationData _options;

        private readonly string _baseAddressWithoutProtocol;
        private readonly string _userDetailsAddress;
        private readonly string _createChangesetAddress;
        private readonly string _uploadChangesetAddress;
        private readonly string _closeChangesetAddress;
        private readonly string _createElementAddress;
        private readonly string _elementAddress;
        private readonly string _completeElementAddress;
        private readonly string _traceAddress;
        private readonly string _getTracesAddress;
        private readonly string _createTraceAddress;

        public OsmGateway(TokenAndSecret tokenAndSecret, IOptions<ConfigurationData> options, ILogger logger) : base(logger)
        {
            _tokenAndSecret = tokenAndSecret;
            _options = options.Value;

            var osmApiBaseAddress = _options.OsmConfiguration.BaseAddress + "/api/0.6/";
            _baseAddressWithoutProtocol = _options.OsmConfiguration.BaseAddress.Replace("http://", "").Replace("https://", "");
            _userDetailsAddress = osmApiBaseAddress + "user/details";
            _createChangesetAddress = osmApiBaseAddress + "changeset/create";
            _uploadChangesetAddress = osmApiBaseAddress + "changeset/:id/upload";
            _closeChangesetAddress = osmApiBaseAddress + "changeset/:id/close";
            _createElementAddress = osmApiBaseAddress + ":type/create";
            _elementAddress = osmApiBaseAddress + ":type/:id";

            _completeElementAddress = osmApiBaseAddress + ":type/:id/full";
            _traceAddress = osmApiBaseAddress + "gpx/:id";
            _getTracesAddress = osmApiBaseAddress + "user/gpx_files";
            _createTraceAddress = osmApiBaseAddress + "gpx/create";
        }

        protected override void UpdateHeaders(HttpClient client, string url, string method = "GET")
        {
            if (url.Contains(_baseAddressWithoutProtocol) == false)
            {
                return;
            }

            var request = new OAuthRequest
            {
                ConsumerKey = _options.OsmConfiguration.ConsumerKey,
                ConsumerSecret = _options.OsmConfiguration.ConsumerSecret,
                Token = _tokenAndSecret.Token,
                TokenSecret = _tokenAndSecret.TokenSecret,
                Type = OAuthRequestType.ProtectedResource,
                SignatureMethod = OAuthSignatureMethod.HmacSha1,
                RequestUrl = url,
                Version = "1.0",
                Method = method
            };
            var auth = request.GetAuthorizationHeader().Replace("OAuth ", "");
            client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("OAuth", auth);
        }

        public async Task<User> GetUser()
        {
            using (var client = new HttpClient())
            {
                UpdateHeaders(client, _userDetailsAddress);
                var response = await client.GetAsync(_userDetailsAddress);
                if (response.StatusCode != HttpStatusCode.OK)
                {
                    return null;
                }
                var streamContent = await response.Content.ReadAsStreamAsync();
                var detailsResponse = FromContent(streamContent);
                return detailsResponse?.User;
            }
        }

        public async Task<string> CreateChangeset(string comment)
        {
            using (var client = new HttpClient())
            {
                UpdateHeaders(client, _createChangesetAddress, "PUT");
                var changeSet = new Osm
                {
                    Changesets = new[]
                    {
                        new Changeset
                        {
                            Tags = new TagsCollection
                            {
                                new Tag {Key = "created_by", Value = "IsraelHiking.osm.org.il"},
                                new Tag {Key = "comment", Value = comment}
                            }
                        }
                    }
                };
                var response = await client.PutAsync(_createChangesetAddress, new StringContent(changeSet.SerializeToXml()));
                if (response.StatusCode != HttpStatusCode.OK)
                {
                    var message = await response.Content.ReadAsStringAsync();
                    throw new Exception($"Unable to create changeset: {message}");
                }
                return await response.Content.ReadAsStringAsync();
            }
        }

        public async Task<DiffResult> UploadChangeset(string changesetId, OsmChange osmChange)
        {
            using (var client = new HttpClient())
            {
                foreach (var osmGeo in osmChange.Create.Concat(osmChange.Modify).Concat(osmChange.Delete))
                {
                    osmGeo.ChangeSetId = long.Parse(changesetId);
                }
                var address = _uploadChangesetAddress.Replace(":id", changesetId);
                UpdateHeaders(client, address, "POST");
                var response = await client.PostAsync(address, new StringContent(osmChange.SerializeToXml()));
                if (response.StatusCode != HttpStatusCode.OK)
                {
                    var message = await response.Content.ReadAsStringAsync();
                    throw new Exception($"Unable to upload changeset: {message}");
                }
                var serializer = new XmlSerializer(typeof(DiffResult));
                return serializer.Deserialize(await response.Content.ReadAsStreamAsync()) as DiffResult;
            }
        }

        public async Task<string> CreateElement(string changesetId, OsmGeo osmGeo)
        {
            using (var client = new HttpClient())
            {
                var address = _createElementAddress.Replace(":type", osmGeo.Type.ToString().ToLower());
                UpdateHeaders(client, address, "PUT");
                var osmRequest = GetOsmRequest(changesetId, osmGeo);
                var response = await client.PutAsync(address, new StringContent(osmRequest.SerializeToXml()));
                if (response.StatusCode != HttpStatusCode.OK)
                {
                    return string.Empty;
                }
                return await response.Content.ReadAsStringAsync();
            }
        }

        public async Task<ICompleteOsmGeo> GetElement(string elementId, string type)
        {
            if (type.Equals(OsmGeoType.Node.ToString(), StringComparison.InvariantCultureIgnoreCase))
            {
                return await GetNode(elementId);
            }
            if (type.Equals(OsmGeoType.Way.ToString(), StringComparison.InvariantCultureIgnoreCase))
            {
                return await GetCompleteWay(elementId);
            }
            if (type.Equals(OsmGeoType.Relation.ToString(), StringComparison.InvariantCultureIgnoreCase))
            {
                return await GetCompleteRelation(elementId);
            }
            throw new ArgumentException($"invalid {nameof(type)}: {type}");
        }

        public Task<CompleteWay> GetCompleteWay(string wayId)
        {
            return GetCompleteElement<CompleteWay>(wayId, "way");
        }

        public Task<CompleteRelation> GetCompleteRelation(string relationId)
        {
            return GetCompleteElement<CompleteRelation>(relationId, "relation");
        }

        private async Task<TCompleteOsmGeo> GetCompleteElement<TCompleteOsmGeo>(string id, string type) where TCompleteOsmGeo : class, ICompleteOsmGeo
        {
            using (var client = new HttpClient())
            {
                var address = _completeElementAddress.Replace(":id", id).Replace(":type", type);
                var response = await client.GetAsync(address);
                if (response.StatusCode != HttpStatusCode.OK)
                {
                    return null;
                }
                var streamSource = new XmlOsmStreamSource(await response.Content.ReadAsStreamAsync());
                var completeSource = new OsmSimpleCompleteStreamSource(streamSource);
                return completeSource.OfType<TCompleteOsmGeo>().FirstOrDefault();
            }
        }

        public Task<Node> GetNode(string nodeId)
        {
            return GetElement<Node>(nodeId, "node");
        }

        public Task<Way> GetWay(string wayId)
        {
            return GetElement<Way>(wayId, "way");
        }

        public Task<Relation> GetRelation(string relationId)
        {
            return GetElement<Relation>(relationId, "relation");
        }

        private async Task<TOsmGeo> GetElement<TOsmGeo>(string id, string type) where TOsmGeo : OsmGeo
        {
            using (var client = new HttpClient())
            {
                var address = _elementAddress.Replace(":id", id).Replace(":type", type);
                var response = await client.GetAsync(address);
                if (response.StatusCode != HttpStatusCode.OK)
                {
                    return null;
                }
                var streamSource = new XmlOsmStreamSource(await response.Content.ReadAsStreamAsync());
                return streamSource.OfType<TOsmGeo>().FirstOrDefault();
            }
        }

        private Osm GetOsmRequest(string changesetId, OsmGeo osmGeo)
        {
            var osm = new Osm();
            long changeSetId = long.Parse(changesetId);
            switch (osmGeo.Type)
            {
                case OsmGeoType.Node:
                    osm.Nodes = new[] { osmGeo as Node };
                    osm.Nodes.First().ChangeSetId = changeSetId;
                    break;
                case OsmGeoType.Way:
                    osm.Ways = new[] { osmGeo as Way };
                    osm.Ways.First().ChangeSetId = changeSetId;
                    break;
                case OsmGeoType.Relation:
                    osm.Relations = new[] { osmGeo as Relation };
                    osm.Relations.First().ChangeSetId = changeSetId;
                    break;
            }
            return osm;
        }

        public Task UpdateElement(string changesetId, ICompleteOsmGeo osmGeo)
        {
            switch (osmGeo.Type)
            {
                case OsmGeoType.Node:
                    return UpdateElement(changesetId, osmGeo as OsmGeo);
                case OsmGeoType.Way:
                    return UpdateElement(changesetId, ((CompleteWay)osmGeo).ToSimple());
                case OsmGeoType.Relation:
                    return UpdateElement(changesetId, ((CompleteRelation)osmGeo).ToSimple());
                default:
                    throw new Exception($"Invalid OSM geometry type: {osmGeo.Type}");
            }
        }

        public async Task UpdateElement(string changesetId, OsmGeo osmGeo)
        {
            using (var client = new HttpClient())
            {
                var address = _elementAddress.Replace(":id", osmGeo.Id.ToString()).Replace(":type", osmGeo.Type.ToString().ToLower());
                UpdateHeaders(client, address, "PUT");
                var osmRequest = GetOsmRequest(changesetId, osmGeo);
                var response = await client.PutAsync(address, new StringContent(osmRequest.SerializeToXml()));
                if (response.StatusCode != HttpStatusCode.OK)
                {
                    var message = await response.Content.ReadAsStringAsync();
                    throw new Exception($"Unable to update {osmGeo.Type} with id: {osmGeo.Id} {message}");
                }
            }
        }

        public async Task CloseChangeset(string changesetId)
        {
            using (var client = new HttpClient())
            {
                var address = _closeChangesetAddress.Replace(":id", changesetId);
                UpdateHeaders(client, address, "PUT");
                var response = await client.PutAsync(address, new StringContent(string.Empty));
                if (response.StatusCode != HttpStatusCode.OK)
                {
                    var message = await response.Content.ReadAsStringAsync();
                    throw new Exception($"Unable to close changeset with id: {changesetId} {message}");
                }
            }
        }

        public async Task<List<GpxFile>> GetTraces()
        {
            using (var client = new HttpClient())
            {
                UpdateHeaders(client, _getTracesAddress);
                var response = await client.GetAsync(_getTracesAddress);
                var stream = await response.Content.ReadAsStreamAsync();
                var osm = FromContent(stream);
                return (osm.GpxFiles ?? new GpxFile[0]).ToList();
            }
        }

        public async Task CreateTrace(string fileName, MemoryStream fileStream)
        {
            using (var client = new HttpClient())
            {
                UpdateHeaders(client, _createTraceAddress, "POST");
                var parameters = new Dictionary<string, string>
                {
                    { "description", Path.GetFileNameWithoutExtension(fileName) },
                    { "visibility", "public" },
                    { "tags", "" },
                };
                var multipartFormDataContent = new MultipartFormDataContent();
                foreach (var keyValuePair in parameters)
                {
                    multipartFormDataContent.Add(new StringContent(keyValuePair.Value),
                        $"\"{keyValuePair.Key}\"");
                }
                var streamContent = new StreamContent(fileStream);
                multipartFormDataContent.Add(streamContent, "file", Encoding.ASCII.GetString(Encoding.ASCII.GetBytes(fileName)));

                var response = await client.PostAsync(_createTraceAddress, multipartFormDataContent);
                if (response.StatusCode != HttpStatusCode.OK)
                {
                    throw new Exception($"Unable to upload the file: {fileName}");
                }
            }
        }

        public async Task UpdateTrace(GpxFile trace)
        {
            using (var client = new HttpClient())
            {
                var traceAddress = _traceAddress.Replace(":id", trace.Id.ToString());
                UpdateHeaders(client, traceAddress, "PUT");

                var osmRequest = new Osm
                {
                    GpxFiles = new[] { trace }
                };
                var response = await client.PutAsync(traceAddress, new StringContent(osmRequest.SerializeToXml()));
                if (response.StatusCode != HttpStatusCode.OK)
                {
                    throw new Exception("Unable to update OSM trace");
                }
            }
        }

        public async Task DeleteTrace(string traceId)
        {
            using (var client = new HttpClient())
            {
                var traceAddress = _traceAddress.Replace(":id", traceId);
                UpdateHeaders(client, traceAddress, "DELETE");
                var response = await client.DeleteAsync(traceAddress);
                if (response.StatusCode != HttpStatusCode.OK)
                {
                    throw new Exception($"Unable to delete OSM trace with ID: {traceId}");
                }
            }
        }

        private Osm FromContent(Stream stream)
        {
            var serializer = new XmlSerializer(typeof(Osm));
            return serializer.Deserialize(stream) as Osm;
        }
    }
}
