using System;
using System.Collections.Concurrent;
using System.Linq;

namespace IsraelHiking.API.Services
{
    public class LruCache<TKey, TValue>
    {
        private const int MAX_CACHE_SIZE = 200;

        internal class CacheItem
        {
            public TValue Value { get; }

            public DateTime LastUsed { get; set; }

            public CacheItem(TValue value)
            {
                Value = value;
                LastUsed = DateTime.Now;
            }
        }

        private readonly ConcurrentDictionary<TKey, CacheItem> _dictionary = new ConcurrentDictionary<TKey, CacheItem>();

        public void Add(TKey key, TValue value)
        {
            _dictionary[key] = new CacheItem(value);
            while (_dictionary.Keys.Count > MAX_CACHE_SIZE)
            {
                var pair = _dictionary.OrderBy(v => v.Value.LastUsed).First();
                CacheItem cacheItem;
                _dictionary.TryRemove(pair.Key, out cacheItem);
            }
        }

        public TValue Get(TKey key)
        {
            if (_dictionary.ContainsKey(key))
            {
                _dictionary[key].LastUsed = DateTime.Now;
                return _dictionary[key].Value;
            }
            return default(TValue);
        }

        public TKey ReverseGet(TValue value)
        {
            return _dictionary.FirstOrDefault(v => v.Value.Value.Equals(value)).Key;
        }
    }
}
