using System.Threading.Tasks;
using IsraelHiking.API.Services;
using IsraelHiking.Common;
using Microsoft.Extensions.Logging;
using Microsoft.VisualStudio.TestTools.UnitTesting;
using NSubstitute;
using Microsoft.Extensions.Options;

namespace IsraelHiking.API.Tests.Services
{
    [TestClass]
    public class LruCacheTests
    {
        private LruCache<string, string> _cache;
        private ConfigurationData _options;

        [TestInitialize]
        public void TestInitialize()
        {
            _options = new ConfigurationData();
            var optionsProvider = Substitute.For<IOptions<ConfigurationData>>();
            optionsProvider.Value.Returns(_options);
            _cache = new LruCache<string, string>(optionsProvider, Substitute.For<ILogger>());
        }

        [TestMethod]
        public void Add_ShouldAdd()
        {
            _options.MaxCacheSize = 2;

            _cache.Add("1", "1");

            Assert.AreEqual("1", _cache.Get("1"));
        }

        [TestMethod]
        public void AddBeyondMax_ShouldRemoveAndAdd()
        {
            _options.MaxCacheSize = 1;

            _cache.Add("1", "1");
            Task.Delay(50).Wait();
            _cache.Add("2", "2");

            Assert.AreEqual(null, _cache.Get("1"));
        }

        [TestMethod]
        public void ReverseGet_ShouldGet()
        {
            _options.MaxCacheSize = 1;

            _cache.Add("1", "11");

            Assert.AreEqual("1", _cache.ReverseGet("11"));
        }
    }
}
