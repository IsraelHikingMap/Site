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

namespace IsraelHiking.DataAccess.OpenStreetMap
{
    public class OsmGateway : BaseFileFetcherGateway, IOsmGateway
    {
        private readonly TokenAndSecret _tokenAndSecret;
        private readonly ConfigurationData _options;

        private readonly string _baseAddressWithoutProtocol;
        private readonly string _userDetailsAddress;
        private readonly string _createChangesetAddress;
        private readonly string _closeChangesetAddress;
        private readonly string _createNodeAddress;
        private readonly string _createWayAddress;
        private readonly string _wayAddress;
        private readonly string _completeWayAddress;
        private readonly string _createTraceAddress;

        public OsmGateway(TokenAndSecret tokenAndSecret, IOptions<ConfigurationData> options, ILogger logger) : base(logger)
        {
            _tokenAndSecret = tokenAndSecret;
            _options = options.Value;

            var osmApiBaseAddress = _options.OsmConfiguraion.BaseAddress.Replace("https", "http") + "/api/0.6/";
            _baseAddressWithoutProtocol = _options.OsmConfiguraion.BaseAddress.Replace("http://", "").Replace("https://", "");
            _userDetailsAddress = osmApiBaseAddress + "user/details";
            _createChangesetAddress = osmApiBaseAddress + "changeset/create";
            _closeChangesetAddress = osmApiBaseAddress + "changeset/#id/close";
            _createNodeAddress = osmApiBaseAddress + "node/create";
            _createWayAddress = osmApiBaseAddress + "way/create";
            _wayAddress = osmApiBaseAddress + "way/#id";
            _completeWayAddress = _wayAddress + "/full";
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
                ConsumerKey = _options.OsmConfiguraion.ConsumerKey,
                ConsumerSecret = _options.OsmConfiguraion.ConsumerSecret,
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

        public async Task<string> GetUserId()
        {
            using (var client = new HttpClient())
            {
                UpdateHeaders(client, _userDetailsAddress);
                var response = await client.GetAsync(_userDetailsAddress);
                if (response.StatusCode != HttpStatusCode.OK)
                {
                    return string.Empty;
                }
                var streamContent = await response.Content.ReadAsStreamAsync();
                var detailsResponse = FromContent(streamContent);
                return detailsResponse?.User?.Id.ToString() ?? string.Empty;
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
                var response = await client.PutAsync(_createChangesetAddress, ToContent(changeSet));
                if (response.StatusCode != HttpStatusCode.OK)
                {
                    return string.Empty;
                }
                return await response.Content.ReadAsStringAsync();
            }
        }

        public async Task<string> CreateNode(string changesetId, Node node)
        {
            using (var client = new HttpClient())
            {
                UpdateHeaders(client, _createNodeAddress, "PUT");
                node.ChangeSetId = long.Parse(changesetId);
                var newNode = new Osm
                {
                    Nodes = new[] { node }
                };
                var response = await client.PutAsync(_createNodeAddress, ToContent(newNode));
                if (response.StatusCode != HttpStatusCode.OK)
                {
                    return string.Empty;
                }
                return await response.Content.ReadAsStringAsync();
            }
        }

        public async Task<string> CreateWay(string changesetId, Way way)
        {
            using (var client = new HttpClient())
            {
                UpdateHeaders(client, _createWayAddress, "PUT");
                way.ChangeSetId = long.Parse(changesetId);
                var newWay = new Osm
                {
                    Ways = new[] { way }
                };
                var response = await client.PutAsync(_createWayAddress, ToContent(newWay));
                if (response.StatusCode != HttpStatusCode.OK)
                {
                    return string.Empty;
                }
                return await response.Content.ReadAsStringAsync();
            }
        }

        public async Task UpdateWay(string changesetId, Way way)
        {
            using (var client = new HttpClient())
            {
                var address = _wayAddress.Replace("#id", way.Id.ToString());
                UpdateHeaders(client, address, "PUT");
                way.ChangeSetId = long.Parse(changesetId);
                var updatedWay = new Osm
                {
                    Ways = new[] { way }
                };
                var response = await client.PutAsync(address, ToContent(updatedWay));
                if (response.StatusCode != HttpStatusCode.OK)
                {
                    var message = await response.Content.ReadAsStringAsync();
                    throw new Exception($"Unable to update way with id: {way.Id} {message}");
                }
            }
        }

        public async Task<CompleteWay> GetCompleteWay(string wayId)
        {
            using (var client = new HttpClient())
            {
                var address = _completeWayAddress.Replace("#id", wayId);
                var response = await client.GetAsync(address);
                if (response.StatusCode != HttpStatusCode.OK)
                {
                    return null;
                }
                var streamSource = new XmlOsmStreamSource(await response.Content.ReadAsStreamAsync());
                var completeSource = new OsmSimpleCompleteStreamSource(streamSource);
                return completeSource.OfType<CompleteWay>().FirstOrDefault();
            }
        }

        public async Task CloseChangeset(string changesetId)
        {
            using (var client = new HttpClient())
            {
                var address = _closeChangesetAddress.Replace("#id", changesetId);
                UpdateHeaders(client, address, "PUT");
                var response = await client.PutAsync(address, new StringContent(string.Empty));
                if (response.StatusCode != HttpStatusCode.OK)
                {
                    var message = await response.Content.ReadAsStringAsync();
                    throw new Exception($"Unable to close changeset with id: {changesetId} {message}");
                }
            }
        }

        public async Task UploadFile(string fileName, MemoryStream fileStream)
        {
            using (var client = new HttpClient())
            {
                UpdateHeaders(client, _createTraceAddress, "POST");
                var parameters = new Dictionary<string, string>
                {
                    { "description", fileName },
                    { "visibility", "private" },
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
                    throw new Exception("Unable to upload the file: " + fileName);
                }
            }
        }

        private StreamContent ToContent(Osm osm)
        {
            var serializer = new XmlSerializer(typeof(Osm));
            var memoryStream = new MemoryStream();
            serializer.Serialize(memoryStream, osm);
            return new StreamContent(memoryStream);
        }

        private Osm FromContent(Stream stream)
        {
            var serializer = new XmlSerializer(typeof(Osm));
            return serializer.Deserialize(stream) as Osm;
        }
    }
}
