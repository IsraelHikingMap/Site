using System.IO;
using IsraelHiking.Common;
using IsraelHiking.DataAccess.Osm;
using IsraelHiking.DataAccessInterfaces;
using Microsoft.VisualStudio.TestTools.UnitTesting;
using NSubstitute;
using OsmSharp.Collections.Tags;
using OsmSharp.Osm;

namespace IsraelHiking.DataAccess.Tests.Osm
{
    [TestClass]
    public class OsmGatewayTests
    {
        private IOsmGateway _gateway;

        [TestInitialize]
        public void TestInitialize()
        {
            var options = new ConfigurationData();
            options.OsmConfiguraion.Returns(new OsmConfiguraionData
            {
                BaseAddress = "http://api06.dev.openstreetmap.org",
                ConsumerKey = "uR7K7PcxOyFG2FnTdTuEqAmlq6hTWPDmF4xknWxQ",
                ConsumerSecret = "hd8WnRpQQtzS04HeFMLUHN2JQtPWzQLOmA6OeE9l"
            });
            var optionsProvider = Substitute.For<IOptions<ConfigurationData>>();
            optionsProvider.Value.Returns(options);
            _gateway = new OsmGateway(new TokenAndSecret("IwrfBMSqyuq3haudBUgfrjflXnvhAcbTvqVBa47l", "eBY4iWlGNMrvERH56vp0jjU8RsVhsroQIns5MQGz"), optionsProvider, new TraceLogger());
        }

        [TestMethod]
        [Ignore]
        public void GetUserId_ShouldGetIt()
        {
            var id = _gateway.GetUserId().Result;

            Assert.AreEqual("4611", id);
        }

        [TestMethod]
        [Ignore]
        public void CreateChangeSet_ShouldBeCreated()
        {
            var id = _gateway.CreateChangeset("").Result;

            Assert.AreNotEqual(-1, id);
        }

        [TestMethod]
        [Ignore]
        public void AddNodeToOsm()
        {
            var node = Node.Create(0, 31.78324, 34.71752);
            node.Tags = new TagsCollection
            {
                {"natural", "spring"},
                { "name", "IHM test"}
            };
            var id = _gateway.CreateChangeset("").Result;
            var nodeId = _gateway.CreateNode(id, node).Result;
            _gateway.CloseChangeset(id).Wait();
            Assert.AreNotEqual(string.Empty, nodeId);
        }

        [TestMethod]
        [Ignore]
        public void AddWayToOsm()
        {
            var node1 = Node.Create(0, 31.78324, 34.71752);
            node1.Tags = new TagsCollection
            {
                {"natural", "spring"},
                { "name", "IHM node test"}
            };
            var node2 = Node.Create(0, 31.78354, 34.71688);
            var id = _gateway.CreateChangeset("").Result;
            var nodeId1 = _gateway.CreateNode(id, node1).Result;
            var nodeId2 = _gateway.CreateNode(id, node2).Result;
            var way = Way.Create(0, long.Parse(nodeId1), long.Parse(nodeId2));
            way.Tags = new TagsCollection
            {
                {"highway", "track"},
                {"name", "IHM way test"}
            };
            var wayId = _gateway.CreateWay(id, way).Result;
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
            var simpleWay = (Way)way.ToSimple();
            simpleWay.Nodes.Insert(1, 4305934441);
            _gateway.UpdateWay(id, simpleWay).Wait();
            _gateway.CloseChangeset(id).Wait();

        }

        [TestMethod]
        [Ignore]
        public void UploadFile()
        {
            //var file = @"C:\Users\harel\Desktop\834159359.gpx";
            var file = @"C:\Users\harel\Desktop\tracklogs-oruxmaps\2014-04-12 עין פיק__20140412_1537.gpx";
            var bytes = File.ReadAllBytes(file);
            _gateway.UploadFile(Path.GetFileName(file), new MemoryStream(bytes)).Wait();
        }
    }
}
