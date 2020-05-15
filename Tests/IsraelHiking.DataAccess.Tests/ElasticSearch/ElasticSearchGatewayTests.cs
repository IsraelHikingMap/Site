using IsraelHiking.Common;
using IsraelHiking.Common.Extensions;
using Microsoft.Extensions.Options;
using Microsoft.VisualStudio.TestTools.UnitTesting;
using NetTopologySuite.Features;
using NetTopologySuite.Geometries;
using NSubstitute;
using System.Collections.Generic;
using System.Linq;

namespace IsraelHiking.DataAccess.Tests.ElasticSearch
{
    [TestClass]
    public class ElasticSearchGatewayTests
    {
        private ElasticSearchGateway _gateway;

        [TestInitialize]
        public void TestInitialize()
        {
            var options = Substitute.For<IOptions<ConfigurationData>>();
            options.Value.Returns(new ConfigurationData());
            _gateway = new ElasticSearchGateway(options, new TraceLogger(), new GeometryFactory());
        }

        [TestMethod]
        [Ignore]
        public void Search_ShouldReturnResults()
        {
            _gateway.Initialize();
            var results = _gateway.Search("מנות", "name").Result;
            Assert.AreEqual(10, results.Count);
        }

        [TestMethod]
        [Ignore]
        public void SearchWithinPlace_ShouldReturnResults()
        {
            _gateway.Initialize();
            var placesFeatures = _gateway.SearchPlaces("תמרת", Languages.HEBREW).Result;
            Assert.AreEqual(5, placesFeatures.Count);
            var envolope = placesFeatures.First().Geometry.EnvelopeInternal;
            var results = _gateway.SearchByLocation(
                new Coordinate(envolope.MaxX, envolope.MaxY), new Coordinate(envolope.MinX, envolope.MinY), "מורן", Languages.HEBREW).Result;
            Assert.AreEqual(1, results.Count);
        }

        [TestMethod]
        [Ignore]
        public void GetHighways_ShouldReturnResults()
        {
            _gateway.Initialize();
            var northEast = new Coordinate(35.0516, 31.7553);
            var southWest = new Coordinate(35.0251, 31.7467);
            var results = _gateway.GetHighways(northEast, southWest).Result;
            Assert.IsNotNull(results[0].Attributes[FeatureAttributes.POI_OSM_NODES] as IEnumerable<object>);
            Assert.AreEqual(38, results.Count);
            
        }

        [TestMethod]
        [Ignore]
        public void SetIndex_ShouldReturnResults()
        {
            _gateway.Initialize();
            _gateway.AddUrl(new ShareUrl {Id = "123", OsmUserId = "789"});
            _ = _gateway.GetUrlsByUser("789").Result;
            _ = _gateway.GetUrlById("123").Result;
            _gateway.Delete(new ShareUrl {Id = "123", OsmUserId = "456"});
        }

        [TestMethod]
        [Ignore]
        public void DeleteThenGet_ShouldReturnEmpty()
        {
            _gateway.Initialize();
            var id = "he_22216";
            var feature = _gateway.GetPointOfInterestById(id, Sources.WIKIPEDIA).Result;
            Assert.IsNotNull(feature);

            _gateway.DeletePointOfInterestById(id, Sources.WIKIPEDIA).Wait();

            feature = _gateway.GetPointOfInterestById(id, Sources.WIKIPEDIA).Result;
            Assert.IsNull(feature);
        }

        [TestMethod]
        [Ignore]
        public void GetContainers_ShouldGetSome()
        {
            _gateway.Initialize();

            var features = _gateway.GetContainers(new Coordinate(35.225306, 32.703806)).Result;

            Assert.IsTrue(features.Count > 0);
        }

        [TestMethod]
        [Ignore]
        public void GetPoisBySource_ShouldGetThem()
        {
            _gateway.Initialize();

            var features = _gateway.GetExternalPoisBySource(Sources.INATURE).Result;
            features = _gateway.GetExternalPoisBySource(Sources.WIKIPEDIA).Result;

            Assert.IsTrue(features.Count > 10000);
        }

        [TestMethod]
        [Ignore]
        public void GetImageByUrl_ShouldGetIt()
        {
            _gateway.Initialize();

            var imageItem = _gateway.GetImageByUrl("https://upload.wikimedia.org/wikipedia/commons/0/05/Israel_Hiking_Map_%D7%97%D7%95%D7%A8%D7%91%D7%AA_%D7%97%D7%A0%D7%95%D7%AA_2.jpeg").Result;

            Assert.IsNotNull(imageItem);
        }

        [TestMethod]
        [Ignore]
        public void GetImageHash_ShouldGetIt()
        {
            _gateway.Initialize();

            var imageItem = _gateway.GetImageByHash("7F4E8F16362FD1E527FFBC516E0197C7").Result;

            Assert.IsNotNull(imageItem);
        }

        [TestMethod]
        [Ignore]
        public void GetAllUrls_ShouldGetThem()
        {
            _gateway.Initialize();

            var imageItem = _gateway.GetAllUrls().Result;

            Assert.IsNotNull(imageItem);
        }

        [TestMethod]
        [Ignore]
        public void UpdatePointOfInterest_ShouldBeAbleToGetRightAfterAdding()
        {
            _gateway.Initialize();
            var id = "42";
            _gateway.DeletePointOfInterestById("1", Sources.OSM).Wait();
            var feature = new Feature(new Point(0, 0), new AttributesTable
            {
                { FeatureAttributes.NAME, "name" },
                { FeatureAttributes.POI_SOURCE, Sources.OSM },
                { FeatureAttributes.ID, id },
            });
            feature.SetId();
            feature.SetTitles();
            _gateway.UpdatePointsOfInterestData(new List<Feature> { feature }).Wait();
            var results = _gateway.GetPointOfInterestById(id, Sources.OSM).Result;
            Assert.IsNotNull(results);
        }
    }
}

