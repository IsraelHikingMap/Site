using IsraelHiking.API.Services;
using IsraelHiking.Common;
using IsraelHiking.Common.Configuration;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using OsmSharp.IO.API;
using System;
using System.Collections.Concurrent;
using System.Linq;
using System.Security.Claims;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Authentication.JwtBearer;

namespace IsraelHiking.Web
{
    /// <summary>
    /// A LockProvider based upon the SemaphoreSlim class to selectively lock objects, resources or statement blocks 
    /// according to given unique IDs in a sync or async way.
    /// 
    /// SAMPLE USAGE & ADDITIONAL INFO:
    /// - https://www.ryadel.com/en/asp-net-core-lock-threads-async-custom-ids-lockprovider/
    /// - https://github.com/Darkseal/LockProvider/
    /// </summary>
    public class LockProvider<T>
    {
        private static readonly LazyConcurrentDictionary<T, InnerSemaphore> LockDictionary = new();

        /// <summary>
        /// Blocks the current thread (according to the given ID) until it can enter the LockProvider
        /// </summary>
        /// <param name="idToLock">the unique ID to perform the lock</param>
        public void Wait(T idToLock)
        {
            LockDictionary.GetOrAdd(idToLock, new InnerSemaphore(1, 1)).Wait();
        }

        /// <summary>
        /// Asynchronously puts thread to wait (according to the given ID) until it can enter the LockProvider
        /// </summary>
        /// <param name="idToLock">the unique ID to perform the lock</param>
        public async Task WaitAsync(T idToLock)
        {
            await LockDictionary.GetOrAdd(idToLock, new InnerSemaphore(1, 1)).WaitAsync();
        }

        public void Release(T idToUnlock)
        {
            if (!LockDictionary.TryGetValue(idToUnlock, out var semaphore))
            {
                return;
            }
            semaphore.Release();
            if (!semaphore.HasWaiters && LockDictionary.TryRemove(idToUnlock, out semaphore))
            {
                semaphore.Dispose();
            }
        }
    }

    public class InnerSemaphore : IDisposable
    {
        private readonly SemaphoreSlim _semaphore;
        private int _waiters;

        public InnerSemaphore(int initialCount, int maxCount)
        {
            _semaphore = new SemaphoreSlim(initialCount, maxCount);
            _waiters = 0;
        }

        public void Wait()
        {
            _waiters++;
            _semaphore.Wait();
        }

        public async Task WaitAsync()
        {
            _waiters++;
            await _semaphore.WaitAsync();
        }

        public void Release()
        {
            _waiters--;
            _semaphore.Release();
        }

        public void Dispose()
        {
            _semaphore?.Dispose();
        }
        public bool HasWaiters => _waiters > 0;
    }

    public class LazyConcurrentDictionary<TKey, TValue>
    {
        private readonly ConcurrentDictionary<TKey, Lazy<TValue>> _concurrentDictionary;

        public LazyConcurrentDictionary()
        {
            _concurrentDictionary = new ConcurrentDictionary<TKey, Lazy<TValue>>();
        }

        public TValue GetOrAdd(TKey key, TValue value)
        {
            var lazyResult = _concurrentDictionary.GetOrAdd(key, _ => new Lazy<TValue>(() => value, LazyThreadSafetyMode.ExecutionAndPublication));
            return lazyResult.Value;
        }

        public TValue GetOrAdd(TKey key, Func<TKey, TValue> valueFactory)
        {
            var lazyResult = _concurrentDictionary.GetOrAdd(key, k => new Lazy<TValue>(() => valueFactory(k), LazyThreadSafetyMode.ExecutionAndPublication));
            return lazyResult.Value;
        }

        public bool TryGetValue(TKey key, out TValue value)
        {
            var success = _concurrentDictionary.TryGetValue(key, out var lazyResult);
            value = (success) ? lazyResult.Value : default(TValue);
            return success;
        }

        public bool TryRemove(TKey key, out TValue value)
        {
            var success = _concurrentDictionary.TryRemove(key, out var lazyResult);
            value = success ? lazyResult.Value : default;
            return success;
        }
    }
    
    public class OsmAccessTokenEventsHelper
    {
        private readonly ILogger _logger;
        private readonly IClientsFactory _clientsFactory;
        private readonly UsersIdAndTokensCache _cache;
        private readonly ConfigurationData _options;
        private readonly LockProvider<string> _lockProvider;
        public OsmAccessTokenEventsHelper(IClientsFactory clientsFactory,
            IOptions<ConfigurationData> options,
            UsersIdAndTokensCache cache,
            ILogger logger)
        {
            _clientsFactory = clientsFactory;
            _cache = cache;
            _options = options.Value;
            _logger = logger;
            _lockProvider = new LockProvider<string>();
        }
        
        public async Task OnMessageReceived(MessageReceivedContext context)
        {
            try
            {
                if (string.IsNullOrEmpty(context.Token))
                {
                    string authorization = context.Request.Headers["Authorization"];

                    // If no authorization header found, nothing to process further
                    if (string.IsNullOrEmpty(authorization))
                    {
                        context.Fail(new Exception("Can't find access token - missing Authorization header"));
                        return;
                    }

                    if (authorization.StartsWith("Bearer ", StringComparison.OrdinalIgnoreCase))
                    {
                        context.Token = authorization.Substring("Bearer ".Length).Trim();
                    }

                    // If no token found, no further work possible
                    if (string.IsNullOrEmpty(context.Token))
                    {
                        context.Fail(new Exception("Can't find access token - Bearer is missing"));
                        return;
                    }
                }
                var split = context.Token.Split(';');
                var token = split.First().Trim('"');
                var tokenSecret = split.Last().Trim('"');
                var tokenAndSecret = new TokenAndSecret(token, tokenSecret);
                await _lockProvider.WaitAsync(context.Token);
                string userId;
                try
                {
                    userId = _cache.ReverseGet(tokenAndSecret);
                    if (string.IsNullOrEmpty(userId))
                    {
                        var osmGateway = _clientsFactory.CreateOAuthClient(_options.OsmConfiguration.ConsumerKey,
                            _options.OsmConfiguration.ConsumerSecret, tokenAndSecret.Token, tokenAndSecret.TokenSecret);
                        var user = await osmGateway.GetUserDetails();
                        userId = user.Id.ToString();
                        _logger.LogInformation($"User {userId} had just logged in");
                        _cache.Add(userId, tokenAndSecret);
                    }
                }
                finally
                {
                    _lockProvider.Release(context.Token);    
                }

                var identity = new ClaimsIdentity("Osm");
                identity.AddClaim(new Claim(ClaimTypes.NameIdentifier, userId));
                identity.AddClaim(new Claim(ClaimTypes.Name, userId));
                context.Principal = new ClaimsPrincipal(identity);
                context.Success();
            }
            catch (Exception ex)
            {
                context.Fail(ex);    
            }
        }
    }
}