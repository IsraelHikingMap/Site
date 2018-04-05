using System.Collections.Generic;
using System.Linq;
using GeoAPI.Geometries;
using IsraelHiking.Common;
using Microsoft.VisualStudio.TestTools.UnitTesting;

namespace IsraelHiking.DataAccess.Tests.ElasticSearch
{
    [TestClass]
    public class ElasticSearchGatewayTests
    {
        [TestMethod]
        [Ignore]
        public void Search_ShouldReturnResults()
        {
            var gateway = new ElasticSearchGateway(new TraceLogger());
            gateway.Initialize();
            var results = gateway.Search("מנות", "name").Result;
            Assert.AreEqual(10, results.Count);
        }

        [TestMethod]
        [Ignore]
        public void SearchWithinPlace_ShouldReturnResults()
        {
            var gateway = new ElasticSearchGateway(new TraceLogger());
            gateway.Initialize();
            var placesFeatures = gateway.SearchPlaces("תמרת", "name").Result;
            Assert.AreEqual(5, placesFeatures.Count);
            var envolope = placesFeatures.First().Geometry.EnvelopeInternal;
            var results = gateway.SearchByLocation(
                new Coordinate(envolope.MaxX, envolope.MaxY), new Coordinate(envolope.MinX, envolope.MinY), "מורן", "name").Result;
            Assert.AreEqual(1, results.Count);
        }

        [TestMethod]
        [Ignore]
        public void GetHighways_ShouldReturnResults()
        {
            var gateway = new ElasticSearchGateway(new TraceLogger());
            gateway.Initialize();
            var northEast = new Coordinate(35.0516, 31.7553);
            var southWest = new Coordinate(35.0251, 31.7467);
            var results = gateway.GetHighways(northEast, southWest).Result;
            Assert.IsNotNull(results[0].Attributes[FeatureAttributes.OSM_NODES] as IEnumerable<object>);
            Assert.AreEqual(38, results.Count);
            
        }

        [TestMethod]
        [Ignore]
        public void SetIndex_ShouldReturnResults()
        {
            var gateway = new ElasticSearchGateway(new TraceLogger());
            gateway.Initialize();
            gateway.AddUrl(new ShareUrl {Id = "123", OsmUserId = "789"});
            var b = gateway.GetUrlsByUser("789").Result;
            var a = gateway.GetUrlById("123").Result;
            gateway.Delete(new ShareUrl {Id = "123", OsmUserId = "456"});
        }

        [TestMethod]
        [Ignore]
        public void DeleteThenGet_ShouldReturnEmpty()
        {
            var gateway = new ElasticSearchGateway(new TraceLogger());
            gateway.Initialize();
            var id = "he_22216";
            var feature = gateway.GetPointOfInterestById(id, Sources.WIKIPEDIA).Result;
            Assert.IsNotNull(feature);

            gateway.DeletePointOfInterestById(id, Sources.WIKIPEDIA).Wait();

            feature = gateway.GetPointOfInterestById(id, Sources.WIKIPEDIA).Result;
            Assert.IsNull(feature);
        }

        [TestMethod]
        [Ignore]
        public void GetContainers_ShouldGetSome()
        {
            var gateway = new ElasticSearchGateway(new TraceLogger());
            gateway.Initialize();

            var features = gateway.GetContainers(new Coordinate(35.225306, 32.703806)).Result;

            Assert.IsTrue(features.Count > 0);
        }
    }
}

