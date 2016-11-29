using System;
using System.Collections.Concurrent;
using System.Linq;
using System.Net;
using System.Threading.Tasks;
using System.Xml.Linq;
using IsraelHiking.DataAccessInterfaces;

namespace IsraelHiking.API.Services
{
    internal class OsmUserCacheKey
    {
        public string Token { get; }
        public string TokenSecret { get; }

        public OsmUserCacheKey(string token, string tokenSecret)
        {
            Token = token;
            TokenSecret = tokenSecret;
        }

        public override bool Equals(object obj)
        {
            var key = obj as OsmUserCacheKey;
            return key != null && Equals(key);
        }

        protected bool Equals(OsmUserCacheKey other)
        {
            return string.Equals(Token, other.Token) && string.Equals(TokenSecret, other.TokenSecret);
        }

        public override int GetHashCode()
        {
            unchecked
            {
                return ((Token?.GetHashCode() ?? 0) * 397) ^ (TokenSecret?.GetHashCode() ?? 0);
            }
        }
    }

    internal class OsmUserCacheItem
    {
        public string UserId { get; }

        public DateTime LastUsed { get; set; }

        public OsmUserCacheItem(string userId)
        {
            UserId = userId;
            LastUsed = DateTime.Now;
        }
    }

    public class OsmUserCache : IOsmUserCache
    {
        private const int MAX_CACHE_SIZE = 200;
        private readonly IOsmGateway _osmGateway;

        private readonly ConcurrentDictionary<OsmUserCacheKey, OsmUserCacheItem> _usersCache =
            new ConcurrentDictionary<OsmUserCacheKey, OsmUserCacheItem>();

        public OsmUserCache(IOsmGateway osmGateway)
        {
            _osmGateway = osmGateway;
        }


        public async Task<string> GetUserId(string token, string tokenSecret)
        {
            var key = new OsmUserCacheKey(token, tokenSecret);
            if (_usersCache.ContainsKey(key))
            {
                _usersCache[key].LastUsed = DateTime.Now;
                return _usersCache[key].UserId;
            }
            var response =
                await _osmGateway.Get("https://www.openstreetmap.org/api/0.6/user/details", token, tokenSecret);
            if (response.StatusCode != HttpStatusCode.OK)
            {
                return string.Empty;
            }
            var osmUserDetailsSteam = response.Content.ReadAsStreamAsync().Result;
            var doc = XDocument.Load(osmUserDetailsSteam);
            var userId = doc.Descendants()
                .Where(x => x.Name.LocalName == "user")
                .Attributes()
                .FirstOrDefault(a => a.Name == "id")?.Value;

            _usersCache[key] = new OsmUserCacheItem(userId);
            while (_usersCache.Keys.Count > MAX_CACHE_SIZE)
            {
                var oldestItemPair = _usersCache.OrderBy(v => v.Value.LastUsed).First();
                OsmUserCacheItem item;
                _usersCache.TryRemove(oldestItemPair.Key, out item);
            }
            return userId;
        }

        public void TryGetTokenAndSecret(string userId, out string token, out string tokenSecret)
        {
            token = string.Empty;
            tokenSecret = string.Empty;
            var pair = _usersCache.FirstOrDefault(v => v.Value.UserId.Equals(userId));
            if (pair.Value == null || !pair.Value.UserId.Equals(userId))
            {
                return;
            }
            token = pair.Key.Token;
            tokenSecret = pair.Key.TokenSecret;
        }
    }
}
