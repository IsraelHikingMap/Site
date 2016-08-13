using System;
using System.Collections.Generic;
using System.IO;
using System.Threading.Tasks;
using GeoJSON.Net.Feature;
using IsraelHiking.API.Services;
using IsraelHiking.Common;
using IsraelHiking.DataAccessInterfaces;
using Microsoft.VisualStudio.TestTools.UnitTesting;
using NSubstitute;
using NSubstitute.ExceptionExtensions;
using OsmSharp.Collections.Tags;
using OsmSharp.Osm;

namespace IsraelHiking.API.Tests.Services
{
    [TestClass]
    public class OsmDataServiceTests
    {
        private IOsmDataService _osmDataService;
        private IGraphHopperHelper _graphHopperHelper;
        private IRemoteFileFetcherGateway _remoteFileFetcherGateway;
        private IFileSystemHelper _fileSystemHelper;
        private IElasticSearchGateway _elasticSearchGateway;
        private INssmHelper _elasticSearchHelper;
        private IOsmRepository _osmRepository;

        private Node CreateNode(int id)
        {
            return new Node
            {
                Id = id,
                Latitude = id,
                Longitude = id,
                Tags = new TagsCollection {{"name", "name"}}
            };
        }

        [TestInitialize]
        public void TestInitialize()
        {
            _graphHopperHelper = Substitute.For<IGraphHopperHelper>();
            _remoteFileFetcherGateway = Substitute.For<IRemoteFileFetcherGateway>();
            _fileSystemHelper = Substitute.For<IFileSystemHelper>();
            _elasticSearchGateway = Substitute.For<IElasticSearchGateway>();
            _elasticSearchHelper = Substitute.For<INssmHelper>();
            _osmRepository = Substitute.For<IOsmRepository>();
            _osmDataService = new OsmDataService(_graphHopperHelper, _remoteFileFetcherGateway, _fileSystemHelper,
                _elasticSearchGateway, _elasticSearchHelper, _osmRepository, Substitute.For<ILogger>());
        }

        [TestMethod]
        public void Initialize_ShouldInitializeAllServices()
        {
            var serverPath = "serverPath";

            _osmDataService.Initialize(serverPath).Wait();

            _graphHopperHelper.Received(1).Initialize(serverPath);
            _elasticSearchHelper.Received(1).Initialize(serverPath);
            _elasticSearchGateway.Received(1).Initialize();
        }

        [TestMethod]
        public void UpdateData_NotInitialized_ShouldThrowsExceptionButNotFail()
        {
            _osmDataService.UpdateData(OsmDataServiceOperations.UpdateGraphHopper).Wait();

            _graphHopperHelper.DidNotReceive().UpdateData(Arg.Any<string>());
        }

        [TestMethod]
        public void UpdateData_NoneAction_ShouldDoNothing()
        {
            _osmDataService.UpdateData(OsmDataServiceOperations.None).Wait();

            _remoteFileFetcherGateway.DidNotReceive().GetFileContent(Arg.Any<string>());
        }

        [TestMethod]
        public void UpdateData_GetOsmFileWhenCurrentFileIsInDeifferentSize_ShouldGetTheFileFromTheWeb()
        {
            _remoteFileFetcherGateway.GetFileSize(Arg.Any<string>()).Returns(Task.FromResult((long)10));
            _fileSystemHelper.GetFileSize(Arg.Any<string>()).Returns(1);
            _remoteFileFetcherGateway.GetFileContent(Arg.Any<string>()).Returns(Task.FromResult(new RemoteFileFetcherGatewayResponse()));

            _osmDataService.Initialize(string.Empty);
            _osmDataService.UpdateData(OsmDataServiceOperations.GetOsmFile).Wait();

            _remoteFileFetcherGateway.Received(1).GetFileContent(Arg.Any<string>());
            _fileSystemHelper.Received(1).WriteAllBytes(Arg.Any<string>(), Arg.Any<byte[]>());
        }

        [TestMethod]
        public void UpdateData_UpdateElasticSearchOneNode_ShouldUpdateGraphHopper()
        {
            var node = CreateNode(1);
            var osmElements = new List<ICompleteOsmGeo> { node };
            _osmRepository.GetElementsWithName(Arg.Any<string>())
                .Returns(
                    Task.FromResult(new Dictionary<string, List<ICompleteOsmGeo>>
                        {
                            {"name", osmElements}
                        }
                    )
                );
            _fileSystemHelper.Exists(Arg.Any<string>()).Returns(true);

            _osmDataService.Initialize(string.Empty);
            _osmDataService.UpdateData(OsmDataServiceOperations.UpdateElasticSearch).Wait();

            _elasticSearchGateway.Received(1).UpdateData(Arg.Any<List<Feature>>());
        }

        [TestMethod]
        public void UpdateData_UpdateElasticSearchTwoNodes_ShouldUpdateGraphHopper()
        {
            var node1 = CreateNode(1);
            var node2 = CreateNode(2);
            var osmElements = new List<ICompleteOsmGeo> { node1, node2 };
            _osmRepository.GetElementsWithName(Arg.Any<string>())
                .Returns(
                    Task.FromResult(new Dictionary<string, List<ICompleteOsmGeo>>
                        {
                            {"name", osmElements}
                        }
                    )
                );
            _fileSystemHelper.Exists(Arg.Any<string>()).Returns(true);

            _osmDataService.Initialize(string.Empty);
            _osmDataService.UpdateData(OsmDataServiceOperations.UpdateElasticSearch).Wait();

            _elasticSearchGateway.Received(1).UpdateData(Arg.Any<List<Feature>>());
        }

        [TestMethod]
        public void UpdateData_UpdateElasticSearchOneNodeOneRelation_ShouldUpdateGraphHopper()
        {
            var node = CreateNode(1);
            var relation = CompleteRelation.Create(2);
            relation.Members.Add(new CompleteRelationMember { Member = node });
            var osmElements = new List<ICompleteOsmGeo> { node, relation };
            _osmRepository.GetElementsWithName(Arg.Any<string>())
                .Returns(
                    Task.FromResult(new Dictionary<string, List<ICompleteOsmGeo>>
                        {
                            {"name", osmElements}
                        }
                    )
                );
            _fileSystemHelper.Exists(Arg.Any<string>()).Returns(true);

            _osmDataService.Initialize(string.Empty);
            _osmDataService.UpdateData(OsmDataServiceOperations.UpdateElasticSearch).Wait();

            _elasticSearchGateway.Received(1).UpdateData(Arg.Any<List<Feature>>());
        }

        [TestMethod]
        public void UpdateData_UpdateElasticSearchTwoWaysThatCantBeMerged_ShouldUpdateGraphHopper()
        {
            var node1 = CreateNode(1);
            var node2 = CreateNode(2);
            var node3 = CreateNode(3);
            var node4 = CreateNode(4);
            var way1 = CompleteWay.Create(5);
            way1.Nodes.AddRange(new [] { node1, node2});
            way1.Tags.Add("waterway", "stream");
            var way2 = CompleteWay.Create(6);
            way2.Nodes.AddRange(new[] { node3, node4 });
            var osmElements = new List<ICompleteOsmGeo> { node1, node2, node3, node4, way1, way2 };
            _osmRepository.GetElementsWithName(Arg.Any<string>())
                .Returns(
                    Task.FromResult(new Dictionary<string, List<ICompleteOsmGeo>>
                        {
                            {"name", osmElements}
                        }
                    )
                );
            _fileSystemHelper.Exists(Arg.Any<string>()).Returns(true);

            _osmDataService.Initialize(string.Empty);
            _osmDataService.UpdateData(OsmDataServiceOperations.UpdateElasticSearch).Wait();

            _elasticSearchGateway.Received(1).UpdateData(Arg.Any<List<Feature>>());
        }

        [TestMethod]
        public void UpdateData_UpdateElasticSearchWithComplexData_ShouldUpdateGraphHopper()
        {
            var node1 = CreateNode(1);
            var node2 = CreateNode(2);
            var node3 = CreateNode(3);
            var node4 = CreateNode(4);
            var node5 = CreateNode(5);
            var node6 = CreateNode(6);
            var node7 = CreateNode(7);
            var node8 = CreateNode(8);
            node8.Tags.Add("place", "any");
            var way1 = CompleteWay.Create(9);
            way1.Tags.Add("name", "name");
            way1.Tags.Add("place", "any");
            way1.Nodes.AddRange(new[] { node2, node3 });
            var way2 = CompleteWay.Create(10);
            way2.Tags.Add("name", "name");
            way2.Tags.Add("place", "any");
            way2.Nodes.AddRange(new [] { node1, node2});
            var way3 = CompleteWay.Create(11);
            way3.Tags.Add("name", "name");
            way3.Tags.Add("place", "any");
            way3.Nodes.AddRange(new[] { node3, node4, node1 });
            var way4 = CompleteWay.Create(12);
            way4.Tags.Add("name", "name");
            way4.Tags.Add("place", "any");
            way4.Nodes.AddRange(new[] { node5, node6 });
            var way5 = CompleteWay.Create(13);
            way5.Tags.Add("name", "name");
            way5.Tags.Add("place", "any");
            way5.Nodes.AddRange(new[] { node7, node6 });
            var relations = CompleteRelation.Create(16);
            relations.Tags.Add("name", "name");
            relations.Tags.Add("place", "any");
            relations.Members.Add(new CompleteRelationMember { Member = way4 });
            relations.Members.Add(new CompleteRelationMember { Member = way5 });
            var osmElements = new List<ICompleteOsmGeo> {node1, node2, node3, node4, node5, node6, node7, node8, way1, way2, way3, way4, relations};

            _osmRepository.GetElementsWithName(Arg.Any<string>())
                .Returns(
                    Task.FromResult(new Dictionary<string, List<ICompleteOsmGeo>>
                        {
                            {"name", osmElements}
                        }
                    )
                );
            _fileSystemHelper.Exists(Arg.Any<string>()).Returns(true);

            _osmDataService.Initialize(string.Empty);
            _osmDataService.UpdateData(OsmDataServiceOperations.UpdateElasticSearch).Wait();

            _elasticSearchGateway.Received(1).UpdateData(Arg.Any<List<Feature>>());
        }

        [TestMethod]
        public void UpdateData_UpdateElasticSearchMergeWaysSameDirection_ShouldUpdateGraphHopper()
        {
            var node1 = CreateNode(1);
            var node2 = CreateNode(2);
            var node3 = CreateNode(3);
            var way1 = CompleteWay.Create(4);
            way1.Tags.Add("name", "name");
            way1.Tags.Add("place", "name");
            way1.Nodes.AddRange(new[] { node2, node3 });
            var way2 = CompleteWay.Create(5);
            way2.Tags.Add("name", "name");
            way2.Tags.Add("place", "name");
            way2.Nodes.AddRange(new[] { node1, node3 });
            var osmElements = new List<ICompleteOsmGeo> { node1, node2, node3, way1, way2 };

            _osmRepository.GetElementsWithName(Arg.Any<string>())
                .Returns(
                    Task.FromResult(new Dictionary<string, List<ICompleteOsmGeo>>
                        {
                            {"name", osmElements}
                        }
                    )
                );
            _fileSystemHelper.Exists(Arg.Any<string>()).Returns(true);

            _osmDataService.Initialize(string.Empty);
            _osmDataService.UpdateData(OsmDataServiceOperations.UpdateElasticSearch).Wait();

            _elasticSearchGateway.Received(1).UpdateData(Arg.Any<List<Feature>>());
        }


        [TestMethod]
        public void UpdateData_UpdateGraphHopper_ShouldUpdateGraphHopper()
        {
            _fileSystemHelper.Exists(Arg.Any<string>()).Returns(true);

            _osmDataService.Initialize(string.Empty);
            _osmDataService.UpdateData(OsmDataServiceOperations.UpdateGraphHopper).Wait();

            _graphHopperHelper.Received(1).UpdateData(Arg.Any<string>());
        }
    }
}
