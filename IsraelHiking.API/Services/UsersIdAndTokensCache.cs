using System;
using IsraelHiking.Common;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace IsraelHiking.API.Services
{
    /// <summary>
    /// Least recently used cache - one-to-one implementation to allow reverse get
    /// </summary>
    public class UsersIdAndTokensCache
    {
        private readonly ILogger _logger;
        private readonly ConfigurationData _options;
        private readonly IMemoryCache _cache;

        /// <summary>
        /// Constructor
        /// </summary>
        /// <param name="options"></param>
        /// <param name="logger"></param>
        /// <param name="memoryCache"></param>
        public UsersIdAndTokensCache(IOptions<ConfigurationData> options, ILogger logger, IMemoryCache memoryCache)
        {
            _logger = logger;
            _options = options.Value;
            _logger.LogInformation("Initializing users Id and tokens cache.");
            _cache = memoryCache;
        }

        /// <summary>
        /// Add item the the cache
        /// </summary>
        /// <param name="userId">The user ID</param>
        /// <param name="tokenAndSecret">The token to add</param>
        public void Add(string userId, TokenAndSecret tokenAndSecret)
        {
            _cache.Set(userId, tokenAndSecret, new MemoryCacheEntryOptions { SlidingExpiration = TimeSpan.FromSeconds(_options.MaxUserTimeInCache) });
            _cache.Set(tokenAndSecret.ToString(), userId, new MemoryCacheEntryOptions { SlidingExpiration = TimeSpan.FromSeconds(_options.MaxUserTimeInCache) });
        }
        
        /// <summary>
        /// Get item from the cache
        /// </summary>
        /// <param name="userId">The user ID</param>
        /// <returns>The item</returns>
        public TokenAndSecret Get(string userId)
        {
            var tokenAndSecret = _cache.Get<TokenAndSecret>(userId);
            if (tokenAndSecret != null)
            {
                // "touch it"
                _cache.Get<string>(tokenAndSecret.ToString());
            }
            return tokenAndSecret;
        }

        /// <summary>
        /// Get the first value that matches the key, assuming this case is one-to-one mostly.
        /// </summary>
        /// <param name="tokenAdnSecret">The token and secret to look for</param>
        /// <returns>The key</returns>
        public string ReverseGet(TokenAndSecret tokenAdnSecret)
        {
            var userId = _cache.Get<string>(tokenAdnSecret.ToString());
            if (!string.IsNullOrEmpty(userId))
            {
                // "touch it"
                _cache.Get(userId);
            }
            return userId;
        }
    }
}
