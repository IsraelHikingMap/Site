using System;
using System.Collections.Concurrent;
using System.Linq;
using IsraelHiking.Common;
using Microsoft.Extensions.Options;

namespace IsraelHiking.API.Services
{
    /// <summary>
    /// Least recently used cache - vary basic implementation.
    /// </summary>
    /// <typeparam name="TKey">Key's type</typeparam>
    /// <typeparam name="TValue">Value's type</typeparam>
    public class LruCache<TKey, TValue> where TKey: class
    {
        private readonly ConfigurationData _options;
        private readonly ConcurrentDictionary<TKey, CacheItem> _dictionary = new ConcurrentDictionary<TKey, CacheItem>();

        /// <summary>
        /// Constructor
        /// </summary>
        /// <param name="options"></param>
        public LruCache(IOptions<ConfigurationData> options)
        {
            _options = options.Value;
        }

        private class CacheItem
        {
            public TValue Value { get; }

            public DateTime LastUsed { get; set; }

            public CacheItem(TValue value)
            {
                Value = value;
                LastUsed = DateTime.Now;
            }
        }

        /// <summary>
        /// Add item the the cache
        /// </summary>
        /// <param name="key">The key</param>
        /// <param name="value">The value</param>
        public void Add(TKey key, TValue value)
        {
            _dictionary[key] = new CacheItem(value);
            while (_dictionary.Keys.Count > _options.MaxCacheSize)
            {
                var pair = _dictionary.OrderBy(v => v.Value.LastUsed).First();
                CacheItem cacheItem;
                _dictionary.TryRemove(pair.Key, out cacheItem);
            }
        }

        /// <summary>
        /// Get item from the cache
        /// </summary>
        /// <param name="key">The key</param>
        /// <returns>The item</returns>
        public TValue Get(TKey key)
        {
            if (key != null && _dictionary.ContainsKey(key))
            {
                _dictionary[key].LastUsed = DateTime.Now;
                return _dictionary[key].Value;
            }
            return default(TValue);
        }

        /// <summary>
        /// Get the first value that matches the key, assuming this case is one-to-one mostly.
        /// </summary>
        /// <param name="value">The value to look for</param>
        /// <returns>The key</returns>
        public TKey ReverseGet(TValue value)
        {
            return _dictionary.FirstOrDefault(v => v.Value.Value.Equals(value)).Key;
        }
    }
}
