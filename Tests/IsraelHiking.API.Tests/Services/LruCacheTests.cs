using System.Threading.Tasks;
using IsraelHiking.API.Services;
using IsraelHiking.DataAccessInterfaces;
using Microsoft.VisualStudio.TestTools.UnitTesting;
using NSubstitute;

namespace IsraelHiking.API.Tests.Services
{
    [TestClass]
    public class LruCacheTests
    {
        private LruCache<string, string> _cache;
        private IConfigurationProvider _configurationProvider;

        [TestInitialize]
        public void TestInitialize()
        {
            _configurationProvider = Substitute.For<IConfigurationProvider>();
            _cache = new LruCache<string, string>(_configurationProvider);
        }

        [TestMethod]
        public void Add_ShouldAdd()
        {
            _configurationProvider.MaxCacheSize.Returns(2);

            _cache.Add("1", "1");

            Assert.AreEqual("1", _cache.Get("1"));
        }

        [TestMethod]
        public void AddBeyondMax_ShouldRemoveAndAdd()
        {
            _configurationProvider.MaxCacheSize.Returns(1);

            _cache.Add("1", "1");
            Task.Delay(50).Wait();
            _cache.Add("2", "2");

            Assert.AreEqual(null, _cache.Get("1"));
        }

        [TestMethod]
        public void ReverseGet_ShouldGet()
        {
            _configurationProvider.MaxCacheSize.Returns(1);

            _cache.Add("1", "11");

            Assert.AreEqual("1", _cache.ReverseGet("11"));
        }
    }
}
