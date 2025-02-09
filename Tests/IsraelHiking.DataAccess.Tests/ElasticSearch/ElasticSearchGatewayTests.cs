using IsraelHiking.Common;
using IsraelHiking.Common.Api;
using IsraelHiking.Common.Configuration;
using Microsoft.Extensions.Options;
using Microsoft.VisualStudio.TestTools.UnitTesting;
using NetTopologySuite.Features;
using NetTopologySuite.Geometries;
using NSubstitute;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using IsraelHiking.DataAccess.ElasticSearch;

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
            _gateway = new ElasticSearchGateway(options, new TraceLogger()); 
            _gateway.Initialize().Wait();
        }

        [TestMethod]
        [Ignore]
        public void Search_ShouldReturnResults()
        {
            var results = _gateway.Search("מנות", "name").Result;
            Assert.AreEqual(10, results.Count);
        }
        
        [TestMethod]
        [Ignore]
        public void GetContainerName_ShouldReturnResults()
        {
            var results = _gateway.GetContainerName([new Coordinate(35.225306, 32.703806)], "he").Result;
            Assert.AreEqual("a", results);
        }

        [TestMethod]
        [Ignore]
        public void SearchWithinPlace_ShouldReturnResults()
        {
            var results = _gateway.SearchPlaces("פינת הזיכרון, רמות מנשה", Languages.HEBREW).Result;
            Assert.AreEqual(1, results.Count);
        }

        [TestMethod]
        [Ignore]
        public void GetHighways_ShouldReturnResults()
        {
            var northEast = new Coordinate(35.0516, 31.7553);
            var southWest = new Coordinate(35.0251, 31.7467);
            var results = _gateway.GetHighways(northEast, southWest).Result;
            Assert.IsNotNull(results[0].Attributes[FeatureAttributes.POI_OSM_NODES] as IEnumerable<object>);
            Assert.AreEqual(38, results.Count);
            
        }

        [TestMethod]
        [Ignore]
        public void GetClosestPoint_ShouldReturnResults()
        {
            var coordinate = new Coordinate(35.303488, 33.027086);
            var results = _gateway.GetClosestPoint(coordinate).Result;
            Assert.IsNotNull(results);
        }
        
        [TestMethod]
        [Ignore]
        public void GetClosestPoint_ShouldNotReturnResults()
        {
            var coordinate = new Coordinate(35.23087, 32.93687);
            var results = _gateway.GetClosestPoint(coordinate).Result;
            Assert.IsNull(results);
        }

        
        
        [TestMethod]
        [Ignore]
        public void SetIndex_ShouldReturnResults()
        {
            _gateway.AddUrl(new ShareUrl {Id = "123", OsmUserId = "789"});
            _ = _gateway.GetUrlsByUser("789").Result;
            _ = _gateway.GetUrlById("123").Result;
            _gateway.Delete(new ShareUrl {Id = "123", OsmUserId = "456"});
        }

        [TestMethod]
        [Ignore]
        public void GetContainerName_MultipleCoordinates_ShouldGetOne()
        {
            var name = _gateway.GetContainerName([new Coordinate(35.052338, 32.598071), new Coordinate(35.061919, 32.595458)], Languages.HEBREW).Result;

            Assert.AreEqual("רמות מנשה", name);
        }

        [TestMethod]
        [Ignore]
        public void GetPoisBySource_ShouldGetThem()
        {
            var tasks = new List<Task<List<IFeature>>>
            {
                _gateway.GetExternalPoisBySource(Sources.INATURE),
                _gateway.GetExternalPoisBySource(Sources.NAKEB),
                _gateway.GetExternalPoisBySource(Sources.WIKIPEDIA)
            };
            Task.WhenAll(tasks).Wait();

            Assert.IsTrue(tasks.Last().Result.Count > 10000);
        }

        [TestMethod]
        [Ignore]
        public void GetImageByUrl_ShouldGetIt()
        {
            var imageItem = _gateway.GetImageByUrl("https://upload.wikimedia.org/wikipedia/commons/0/05/Israel_Hiking_Map_%D7%97%D7%95%D7%A8%D7%91%D7%AA_%D7%97%D7%A0%D7%95%D7%AA_2.jpeg").Result;

            Assert.IsNotNull(imageItem);
        }

        [TestMethod]
        [Ignore]
        public void GetImageHash_ShouldGetIt()
        {
            var imageItem = _gateway.GetImageByHash("7F4E8F16362FD1E527FFBC516E0197C7").Result;

            Assert.IsNotNull(imageItem);
        }

        [TestMethod]
        [Ignore]
        public void GetAllUrls_ShouldGetThem()
        {
            var imageItem = _gateway.GetAllUrls().Result;

            Assert.IsNotNull(imageItem);
        }

        [TestMethod]
        [Ignore]
        public void GetAllPointsOfInterest_ShouldGetThem()
        {
            var results = _gateway.GetAllPointsOfInterest().Result;

            Assert.IsNotNull(results);
        }

        [TestMethod]
        [Ignore]
        public void StoreRebuildContext_ShouldStore()
        {
            _gateway.StoreRebuildContext(new RebuildContext
            {
                StartTime = DateTime.Now.AddDays(-5),
                Succeeded = true,
                ErrorMessage = string.Empty,
                Request = new UpdateRequest
                {
                    PointsOfInterest = true,
                    AllExternalSources = true,
                }
            }).Wait();
        }

        [TestMethod]
        [Ignore]
        public void GetUrlTimestampById_ShouldSGetIt()
        {
            var results = _gateway.GetUrlTimestampById("mXgPc5nohX").Result;

            Assert.IsTrue(results > DateTime.MinValue);
        }
        
        [TestMethod]
        [Ignore]
        public void SearchExact_ShouldSGetAnExactMatch()
        {
            var results = _gateway.SearchExact("חיפה", Languages.HEBREW).Result;

            Assert.IsTrue(results.Count > 0);
        }
    }
}

