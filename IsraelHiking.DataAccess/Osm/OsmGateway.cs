using System;
using System.Collections.Generic;
using System.Linq;
using System.Net;
using System.Net.Http;
using System.Net.Http.Formatting;
using System.Net.Http.Headers;
using System.Threading.Tasks;
using IsraelHiking.Common;
using IsraelHiking.DataAccessInterfaces;
using OAuth;
using OsmSharp.Collections.Tags;
using OsmSharp.Osm;
using OsmSharp.Osm.Xml.v0_6;

namespace IsraelHiking.DataAccess.Osm
{
    public class OsmGateway : BaseFileFetcherGateway, IOsmGateway
    {
        private readonly TokenAndSecret _tokenAndSecret;
        private readonly MediaTypeFormatter _xmlMediaTypeFormatter;

        
        //private const string OSM_ADDRESS = "api06.dev.openstreetmap.org"; // DEV
        private const string OSM_ADDRESS = "www.openstreetmap.org";
        private const string OSM_API_BASE_ADDRESS = "http://" + OSM_ADDRESS + "/api/0.6/";
        private const string OSM_USER_DETAILS_ADDRESS = OSM_API_BASE_ADDRESS + "user/details";
        private const string OSM_CREATE_CHANGESET_ADDRESS = OSM_API_BASE_ADDRESS + "changeset/create";
        private const string OSM_CLOSE_CHANGESET_ADDRESS = OSM_API_BASE_ADDRESS + "changeset/#id/close";
        private const string OSM_CREATE_NODE_ADDRESS = OSM_API_BASE_ADDRESS + "node/create";
        private const string OSM_CREATE_WAY_ADDRESS = OSM_API_BASE_ADDRESS + "way/create";

        public OsmGateway(TokenAndSecret tokenAndSecret, ILogger logger) : base(logger)
        {
            _tokenAndSecret = tokenAndSecret;
            _xmlMediaTypeFormatter = new XmlMediaTypeFormatter {UseXmlSerializer = true};
        }

        protected override void UpdateHeaders(HttpClient client, string url, string method = "GET")
        {
            if (url.Contains(OSM_ADDRESS) == false)
            {
                return;
            }

            var request = new OAuthRequest
            {
                ConsumerKey = "H5Us9nv9eDyFpKbBTiURf7ZqfdBArNddv10n6R6U",
                ConsumerSecret = "ccYaQUKLz26XEzbNd8uWoQ6HwbcnrUUp8milXnXG",
                //ConsumerKey = "uR7K7PcxOyFG2FnTdTuEqAmlq6hTWPDmF4xknWxQ", // DEV
                //ConsumerSecret = "hd8WnRpQQtzS04HeFMLUHN2JQtPWzQLOmA6OeE9l", // DEV
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
                UpdateHeaders(client, OSM_USER_DETAILS_ADDRESS);
                var response = await client.GetAsync(OSM_USER_DETAILS_ADDRESS);
                if (response.StatusCode != HttpStatusCode.OK)
                {
                    return string.Empty;
                }
                var detailsResponse = await response.Content.ReadAsAsync<osm>(new List<MediaTypeFormatter> {_xmlMediaTypeFormatter});
                return detailsResponse?.user?.id.ToString() ?? string.Empty;
            }
        }

        public async Task<string> CreateChangeset()
        {
            using (var client = new HttpClient())
            {
                UpdateHeaders(client, OSM_CREATE_CHANGESET_ADDRESS, "PUT");
                var changeSet = new osm
                {
                    changeset = new[]
                    {
                        new changeset
                        {
                            tag = new[]
                            {
                                new tag {k = "created_by", v = "Israel Hiking Map"},
                                new tag {k = "comment", v = "Missing route finder algorithm"}
                            }
                        }
                    }
                };
                var response = await client.PutAsync(OSM_CREATE_CHANGESET_ADDRESS, new ObjectContent(typeof(osm), changeSet, _xmlMediaTypeFormatter));
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
                UpdateHeaders(client, OSM_CREATE_NODE_ADDRESS, "PUT");
                var newNode = new osm
                {
                    node = new[]
                    {
                        new node
                        {
                            changeset = long.Parse(changesetId),
                            changesetSpecified = true,
                            lat = node.Latitude.Value,
                            latSpecified = true,
                            lon = node.Longitude.Value,
                            lonSpecified = true,
                            tag = ConvertTags(node.Tags)
                        }
                    }
                };
                var response = await client.PutAsync(OSM_CREATE_NODE_ADDRESS, new ObjectContent(typeof(osm), newNode, _xmlMediaTypeFormatter));
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
                UpdateHeaders(client, OSM_CREATE_WAY_ADDRESS, "PUT");
                var newWay = new osm
                {
                    way = new[]
                    {
                        new way
                        {
                            changeset = long.Parse(changesetId),
                            changesetSpecified = true,
                            nd = way.Nodes.Select(n => new nd {@ref = n, refSpecified = true}).ToArray(),
                            tag = ConvertTags(way.Tags)
                        }
                    }
                };
                var response = await client.PutAsync(OSM_CREATE_WAY_ADDRESS, new ObjectContent(typeof(osm), newWay, _xmlMediaTypeFormatter));
                if (response.StatusCode != HttpStatusCode.OK)
                {
                    return string.Empty;
                }
                return await response.Content.ReadAsStringAsync();
            }
        }

        public async Task CloseChangeset(string changesetId)
        {
            using (var client = new HttpClient())
            {
                var address = OSM_CLOSE_CHANGESET_ADDRESS.Replace("#id", changesetId);
                UpdateHeaders(client, address, "PUT");
                var response = await client.PutAsync(address, new StringContent(string.Empty));
                if (response.StatusCode != HttpStatusCode.OK)
                {
                    throw new Exception("Unable to close changeset with id: " + changesetId);
                }
            }
        }

        private tag[] ConvertTags(TagsCollectionBase tags)
        {
            return (tags ?? new TagsCollection()).ToStringStringDictionary()
                .Select(kvp => new tag {k = kvp.Key, v = kvp.Value})
                .ToArray();
        }
    }
}
