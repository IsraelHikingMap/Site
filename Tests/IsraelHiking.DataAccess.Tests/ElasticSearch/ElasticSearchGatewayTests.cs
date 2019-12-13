using IsraelHiking.Common;
using Microsoft.VisualStudio.TestTools.UnitTesting;
using NetTopologySuite.Geometries;
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
            _gateway = new ElasticSearchGateway(new TraceLogger(), new GeometryFactory());
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
        //[Ignore]
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
    }
}

