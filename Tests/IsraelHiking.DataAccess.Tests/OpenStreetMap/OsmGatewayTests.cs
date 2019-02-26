using System.IO;
using IsraelHiking.Common;
using IsraelHiking.DataAccess.OpenStreetMap;
using IsraelHiking.DataAccessInterfaces;
using Microsoft.VisualStudio.TestTools.UnitTesting;
using NSubstitute;
using OsmSharp;
using Microsoft.Extensions.Options;
using OsmSharp.Tags;
using System.Linq;

namespace IsraelHiking.DataAccess.Tests.OpenStreetMap
{
    [TestClass]
    public class OsmGatewayTests
    {
        private IOsmGateway _gateway;

        [TestInitialize]
        public void TestInitialize()
        {
            var options = new ConfigurationData()
            {
                OsmConfiguration = new OsmConfiguraionData
                {
                    BaseAddress = "http://api06.dev.openstreetmap.org",
                    ConsumerKey = "uR7K7PcxOyFG2FnTdTuEqAmlq6hTWPDmF4xknWxQ",
                    ConsumerSecret = "hd8WnRpQQtzS04HeFMLUHN2JQtPWzQLOmA6OeE9l"
                }
            };
            var optionsProvider = Substitute.For<IOptions<ConfigurationData>>();
            optionsProvider.Value.Returns(options);
            _gateway = new OsmGateway(new TokenAndSecret("IwrfBMSqyuq3haudBUgfrjflXnvhAcbTvqVBa47l", "eBY4iWlGNMrvERH56vp0jjU8RsVhsroQIns5MQGz"), optionsProvider, new TraceLogger());
        }

        [TestMethod]
        [Ignore]
        public void GetUser_ShouldGetIt()
        {
            var id = _gateway.GetUser().Result.Id;

            Assert.AreEqual("4611", id);
        }

        [TestMethod]
        [Ignore]
        public void CreateChangeSet_ShouldBeCreated()
        {
            var id = _gateway.CreateChangeset("").Result;

            Assert.AreNotEqual(string.Empty, id);

            _gateway.CloseChangeset(id).Wait();
        }

        [TestMethod]
        [Ignore]
        public void AddNodeToOsm()
        {
            var node = new Node
            {
                Id = 0,
                Latitude = 31.78324,
                Longitude = 34.71752,
                Tags = new TagsCollection
                {
                    {"natural", "spring"},
                    {"name", "IHM test"}
                }
            };
            var id = _gateway.CreateChangeset("").Result;
            var nodeId = _gateway.CreateElement(id, node).Result;
            _gateway.CloseChangeset(id).Wait();
            Assert.AreNotEqual(string.Empty, nodeId);
        }

        [TestMethod]
        [Ignore]
        public void AddWayToOsm()
        {
            var node1 = new Node
            {
                Id = 0,
                Latitude = 31.78324,
                Longitude = 34.71752,
                Tags = new TagsCollection
                {
                    {"natural", "spring"},
                    {"name", "IHM node test"}
                }
            };
            var node2 = new Node { Id = 0, Latitude = 31.78354, Longitude = 34.71688 };
            var id = _gateway.CreateChangeset("").Result;
            var nodeId1 = _gateway.CreateElement(id, node1).Result;
            var nodeId2 = _gateway.CreateElement(id, node2).Result;
            var way = new Way
            {
                Id = 0,
                Nodes = new[] {long.Parse(nodeId1), long.Parse(nodeId2)},
                Tags = new TagsCollection
                {
                    {"highway", "track"},
                    {"name", "IHM way test"}
                }
            };
            var wayId = _gateway.CreateElement(id, way).Result;
            _gateway.CloseChangeset(id).Wait();
            Assert.AreNotEqual(string.Empty, wayId);
        }

        [TestMethod]
        [Ignore]
        public void GetCompleteWay()
        {
            var way = _gateway.GetCompleteWay("30969247").Result;
            Assert.IsNotNull(way);
        }

        [TestMethod]
        [Ignore]
        public void UpdateWay()
        {
            var id = _gateway.CreateChangeset("test - add middle node in way").Result;
            var way = _gateway.GetCompleteWay("4302709797").Result;
            //var simpleWay = (Way)way.ToSimple();
            var simpleWay = new Way { Tags = way.Tags, Id = way.Id, Version = way.Version };
            var list = way.Nodes.Select(n => n.Id ?? 0).ToList();
            list.Insert(1, 4305934441);
            simpleWay.Nodes = list.ToArray();
            _gateway.CreateElement(id, simpleWay).Wait();
            _gateway.CloseChangeset(id).Wait();
        }

        [TestMethod]
        [Ignore]
        public void UploadFile()
        {
            //var file = @"C:\Users\harel\Desktop\834159359.gpx";
            var file = @"C:\Users\harel\Desktop\tracklogs-oruxmaps\2014-04-12 עין פיק__20140412_1537.gpx";
            var bytes = File.ReadAllBytes(file);
            _gateway.CreateTrace(Path.GetFileName(file), new MemoryStream(bytes)).Wait();
        }
    }
}
