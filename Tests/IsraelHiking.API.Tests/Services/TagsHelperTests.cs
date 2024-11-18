using IsraelHiking.API.Services;
using IsraelHiking.Common;
using IsraelHiking.Common.Configuration;
using Microsoft.Extensions.Options;
using Microsoft.VisualStudio.TestTools.UnitTesting;
using NetTopologySuite.Features;
using NSubstitute;

namespace IsraelHiking.API.Tests.Services
{
    [TestClass]
    public class TagsHelperTests
    {
        private ITagsHelper _tagsHelper;
        private ConfigurationData _configuration;

        [TestInitialize]
        public void TestInitialize()
        {
            _configuration = new ConfigurationData();
            var options = Substitute.For<IOptions<ConfigurationData>>();
            options.Value.Returns(_configuration);
            _tagsHelper = new TagsHelper(options);
        }

        [TestMethod]
        public void RegularPlace_ShouldReturnHomeIconNoneCategory()
        {
            var (factor, iconColorCategory) = _tagsHelper.GetInfo(new AttributesTable
            {
                {"place", "place"}
            });

            Assert.AreEqual(2, factor);
            Assert.AreEqual("icon-home", iconColorCategory.Icon);
            Assert.AreEqual(Categories.NONE, iconColorCategory.Category);
        }

        [TestMethod]
        public void PlaceWithWikipediaTag_ShouldReturnHomeIconWikipediaCategory()
        {
            var (factor, iconColorCategory) = _tagsHelper.GetInfo(new AttributesTable
            {
                {"place", "place"},
                {"wikipedia", "wiki title" }
            });

            Assert.AreEqual(2, factor);
            Assert.AreEqual("icon-home", iconColorCategory.Icon);
            Assert.AreEqual(Categories.WIKIPEDIA, iconColorCategory.Category);
        }

        [TestMethod]
        public void Spring_ShouldReturnTintIconWaterCategory()
        {
            var (factor, iconColorCategory) = _tagsHelper.GetInfo(new AttributesTable
            {
                {"natural", "spring"},
                {"wikipedia", "wiki title" }
            });

            Assert.AreEqual(2, factor);
            Assert.AreEqual("icon-tint", iconColorCategory.Icon);
            Assert.AreEqual(Categories.WATER, iconColorCategory.Category);
        }

        [TestMethod]
        public void WikipediaOnly_ShouldReturnWikipediaIconWikipediaCategory()
        {
            var (factor, iconColorCategory) = _tagsHelper.GetInfo(new AttributesTable
            {
                {"wikipedia", "wiki title" }
            });

            Assert.AreEqual(2, factor);
            Assert.AreEqual("icon-wikipedia-w", iconColorCategory.Icon);
            Assert.AreEqual(Categories.WIKIPEDIA, iconColorCategory.Category);
        }

        [TestMethod]
        public void BusStop_ShouldReturnBusStopIconNoneCategory()
        {
            var (factor, iconColorCategory) = _tagsHelper.GetInfo(new AttributesTable
            {
                {"highway", "bus_stop"}
            });

            Assert.AreEqual(_configuration.SearchFactor, factor);
            Assert.AreEqual("icon-bus-stop", iconColorCategory.Icon);
            Assert.AreEqual(Categories.NONE, iconColorCategory.Category);
        }

        [TestMethod]
        public void Street_ShouldReturnSignsIconNoneCategory()
        {
            var (factor, iconColorCategory) = _tagsHelper.GetInfo(new AttributesTable
            {
                {"highway", "residential"}
            });

            Assert.AreEqual(_configuration.SearchFactor, factor);
            Assert.AreEqual("icon-map-signs", iconColorCategory.Icon);
            Assert.AreEqual(Categories.NONE, iconColorCategory.Category);
        }

        [TestMethod]
        public void Nothing_ShouldReturnEmptyIconNoneCategory()
        {
            var (factor, iconColorCategory) = _tagsHelper.GetInfo(new AttributesTable());

            Assert.AreEqual(_configuration.SearchFactor, factor);
            Assert.AreEqual(string.Empty, iconColorCategory.Icon);
            Assert.AreEqual(Categories.NONE, iconColorCategory.Category);
        }

        [TestMethod]
        public void AWayWithMtbName_ShouldReturnBikeIconWithFactorOne()
        {
            var (factor, iconColorCategory) = _tagsHelper.GetInfo(new AttributesTable
            {
                {FeatureAttributes.MTB_NAME, "some-name"}
            });

            Assert.AreEqual(2, factor);
            Assert.AreEqual("icon-bike", iconColorCategory.Icon);
            Assert.AreEqual(Categories.ROUTE_BIKE, iconColorCategory.Category);
        }
        
        [TestMethod]
        public void River_ShouldReturnHighFactor()
        {
            var (factor, iconColorCategory) = _tagsHelper.GetInfo(new AttributesTable
            {
                {"waterway", "river"}
            });

            Assert.AreEqual(2, factor);
            Assert.AreEqual(Categories.NONE, iconColorCategory.Category);
        }
        
        [TestMethod]
        public void Stream_ShouldReturnHighFactor()
        {
            var (factor, iconColorCategory) = _tagsHelper.GetInfo(new AttributesTable
            {
                {"waterway", "stream"}
            });

            Assert.AreEqual(2, factor);
            Assert.AreEqual(Categories.NONE, iconColorCategory.Category);
        }
        
        [TestMethod]
        public void Wadi_ShouldReturnHighFactor()
        {
            var (factor, iconColorCategory) = _tagsHelper.GetInfo(new AttributesTable
            {
                {"waterway", "wadi"}
            });

            Assert.AreEqual(2, factor);
            Assert.AreEqual(Categories.NONE, iconColorCategory.Category);
        }
        
        [TestMethod]
        public void Farm_ShouldReturnHighFactor()
        {
            var (factor, iconColorCategory) = _tagsHelper.GetInfo(new AttributesTable
            {
                {"landuse", "farmyard"}
            });

            Assert.AreEqual(2, factor);
            Assert.AreEqual(Categories.NONE, iconColorCategory.Category);
        }
        
        [TestMethod]
        public void Peak_WithNoDescription_ShouldReturnNoneCategory()
        {
            var (factor, iconColorCategory) = _tagsHelper.GetInfo(new AttributesTable
            {
                {"natural", "peak"},
            });

            Assert.AreEqual(2, factor);
            Assert.AreEqual(Categories.NONE, iconColorCategory.Category);
        }
        
        [TestMethod]
        public void Peak_WithDescription_ShouldReturnNaturalCategory()
        {
            var (factor, iconColorCategory) = _tagsHelper.GetInfo(new AttributesTable
            {
                {"natural", "peak"},
                {FeatureAttributes.DESCRIPTION, "desc"}
            });

            Assert.AreEqual(2, factor);
            Assert.AreEqual(Categories.NATURAL, iconColorCategory.Category);
        }
        
        [TestMethod]
        public void Peak_WithImage_ShouldReturnNaturalCategory()
        {
            var (factor, iconColorCategory) = _tagsHelper.GetInfo(new AttributesTable
            {
                {"natural", "peak"},
                {FeatureAttributes.IMAGE_URL, "image_url"}
            });

            Assert.AreEqual(2, factor);
            Assert.AreEqual(Categories.NATURAL, iconColorCategory.Category);
        }
    }
}
