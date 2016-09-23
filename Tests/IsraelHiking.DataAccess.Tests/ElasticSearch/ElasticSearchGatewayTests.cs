using System.Collections.Generic;
using System.Threading.Tasks;
using GeoJSON.Net.Feature;
using GeoJSON.Net.Geometry;
using IsraelHiking.DataAccess.ElasticSearch;
using Microsoft.VisualStudio.TestTools.UnitTesting;
using Newtonsoft.Json;

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
        public void FindShapes()
        {
            var gateway = new ElasticSearchGateway(new TraceLogger());
            gateway.Initialize();
            var features = new List<Feature>
            {
                new Feature(
                    new Polygon(
                        new List<LineString>
                        {
                            new LineString(
                                new[]
                                {
                                    new GeographicPosition(0, 0),
                                    new GeographicPosition(1, 0),
                                    new GeographicPosition(1, 1),
                                    new GeographicPosition(0, 1),
                                    new GeographicPosition(0, 0)
                                }
                            )
                        }
                    ),
                    new Dictionary<string, object>
                    {
                        {"name", "polygon"},
                        {"place", "city"},
                        {"osm_id", "1"}
                    }
                ),
                new Feature(
                    new LineString(
                        new[]
                        {
                            new GeographicPosition(0.5, 0.5),
                            new GeographicPosition(0.6, 0.6)
                        }
                    ),
                    new Dictionary<string, object>
                    {
                        {"name", "street"},
                        {"highway", "residential"},
                        {"osm_id", "2"}
                    }
                )
            };
            gateway.UpdateData(features).Wait();
            Task.Delay(2000).Wait();
            var results = gateway.GetContainingFeature(features[1]).Result;
            Assert.IsNotNull(results);
        }
    }
}

