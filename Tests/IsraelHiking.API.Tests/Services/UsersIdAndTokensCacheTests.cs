using System.Threading.Tasks;
using IsraelHiking.API.Services;
using IsraelHiking.Common;
using Microsoft.Extensions.Logging;
using Microsoft.VisualStudio.TestTools.UnitTesting;
using NSubstitute;
using Microsoft.Extensions.Options;
using Microsoft.Extensions.Caching.Memory;

namespace IsraelHiking.API.Tests.Services
{
    [TestClass]
    public class UsersIdAndTokensCacheTests
    {
        private UsersIdAndTokensCache _cache;
        private ConfigurationData _options;

        [TestInitialize]
        public void TestInitialize()
        {
            _options = new ConfigurationData();
            var optionsProvider = Substitute.For<IOptions<ConfigurationData>>();
            optionsProvider.Value.Returns(_options);
            _cache = new UsersIdAndTokensCache(optionsProvider, Substitute.For<ILogger>(), new MemoryCache(new MemoryCacheOptions()));
        }

        [TestMethod]
        public void Add_ShouldAdd()
        {
            _options.MaxUserTimeInCache = 2;

            _cache.Add("1", new TokenAndSecret("2", "3"));

            Assert.AreEqual(new TokenAndSecret("2", "3").ToString(), _cache.Get("1").ToString());
        }

        [TestMethod]
        public void AddBeyondMax_ShouldRemoveAndAdd()
        {
            _options.MaxUserTimeInCache = 1;

            _cache.Add("1", new TokenAndSecret("2", "3"));
            Task.Delay(2000).Wait();
            _cache.Add("2", new TokenAndSecret("4", "5"));
            Assert.AreEqual(null, _cache.Get("1"));
        }

        [TestMethod]
        public void ReverseGet_ShouldGet()
        {
            _options.MaxUserTimeInCache = 100;
            var tokenAndSecret = new TokenAndSecret("2", "3");
            _cache.Add("1", tokenAndSecret);

            Assert.AreEqual("1", _cache.ReverseGet(tokenAndSecret));
        }
    }
}
