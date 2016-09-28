using System.Collections.Generic;
using System.Threading.Tasks;
using GeoAPI.Geometries;
using IsraelHiking.DataAccess.ElasticSearch;
using Microsoft.VisualStudio.TestTools.UnitTesting;
using NetTopologySuite.Features;
using NetTopologySuite.Geometries;

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
            var table1 = new AttributesTable();
            table1.AddAttribute("name", "polygon");
            table1.AddAttribute("place", "city");
            table1.AddAttribute("osm_id", "1");
            var table2 = new AttributesTable();
            table2.AddAttribute("name", "street");
            table2.AddAttribute("highway", "residential");
            table2.AddAttribute("osm_id", "2");
            var features = new List<Feature>
            {
                new Feature(
                    new Polygon(
                            new LinearRing(
                                new[]
                                {
                                    new Coordinate(0, 0),
                                    new Coordinate(1, 0),
                                    new Coordinate(1, 1),
                                    new Coordinate(0, 1),
                                    new Coordinate(0, 0)
                                }
                            )
                    ),
                    table1
                ),
                new Feature(
                    new LineString(
                        new[]
                        {
                            new Coordinate(0.5, 0.5), 
                            new Coordinate(0.6, 0.6)
                        }
                    ),
                    table2
                )
            };
            gateway.UpdateData(features).Wait();
            Task.Delay(2000).Wait();
            var results = gateway.GetContainingFeature(features[1]).Result;
            Assert.IsNotNull(results);
        }
    }
}

