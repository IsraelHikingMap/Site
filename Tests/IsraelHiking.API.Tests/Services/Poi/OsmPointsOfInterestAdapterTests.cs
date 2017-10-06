using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Threading.Tasks;
using GeoAPI.Geometries;
using IsraelHiking.API.Converters;
using IsraelHiking.API.Executors;
using IsraelHiking.API.Services;
using IsraelHiking.API.Services.Poi;
using IsraelHiking.Common;
using IsraelHiking.DataAccessInterfaces;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using Microsoft.VisualStudio.TestTools.UnitTesting;
using NetTopologySuite.Features;
using NetTopologySuite.Geometries;
using NSubstitute;
using OsmSharp;
using OsmSharp.Complete;
using OsmSharp.Tags;

namespace IsraelHiking.API.Tests.Services.Poi
{
    [TestClass]
    public class OsmPointsOfInterestAdapterTests
    {
        private OsmPointsOfInterestAdapter _adapter;
        private IElasticSearchGateway _elasticSearchGateway;
        private IElevationDataStorage _elevationDataStorage;
        private IHttpGatewayFactory _httpGatewayFactory;
        private IOsmGeoJsonPreprocessorExecutor _osmGeoJsonPreprocessorExecutor;
        private IOsmRepository _osmRepository;
        private ITagsHelper _tagsHelper;

        [TestInitialize]
        public void TestInitialize()
        {
            _elasticSearchGateway = Substitute.For<IElasticSearchGateway>();
            _elevationDataStorage = Substitute.For<IElevationDataStorage>();
            _httpGatewayFactory = Substitute.For<IHttpGatewayFactory>();
            _tagsHelper = new TagsHelper(new OptionsWrapper<ConfigurationData>(new ConfigurationData()));
            _osmGeoJsonPreprocessorExecutor = new OsmGeoJsonPreprocessorExecutor(Substitute.For<ILogger>(), new OsmGeoJsonConverter(), _tagsHelper);
            _osmRepository = Substitute.For<IOsmRepository>();

            _adapter = new OsmPointsOfInterestAdapter(_elasticSearchGateway, _elevationDataStorage, _httpGatewayFactory, _osmGeoJsonPreprocessorExecutor, _osmRepository, _tagsHelper);
        }

        private IOsmGateway SetupHttpFactory()
        {
            var gateway = Substitute.For<IOsmGateway>();
            _httpGatewayFactory.CreateOsmGateway(Arg.Any<TokenAndSecret>()).Returns(gateway);
            return gateway;
        }

        [TestMethod]
        public void UpdatePoint_SyncImages()
        {
            var gateway = SetupHttpFactory();
            var pointOfInterest = new PointOfInterestExtended
            {
                ImagesUrls = new[] { "imageurl2", "imageurl1", "imageurl4" },
                Id = "1",
                Icon = "oldIcon"
            };
            _elasticSearchGateway.GetPointOfInterestById(pointOfInterest.Id, Arg.Any<string>())
                .Returns(new Feature(new Point(new Coordinate()), new AttributesTable
                {
                    {FeatureAttributes.ICON, "icon"}
                }));
            gateway.GetNode(pointOfInterest.Id).Returns(Task.FromResult(new Node
            {
                Id = 1,
                Tags = new TagsCollection
                {
                    new Tag("image", "imageurl1"),
                    new Tag("image1", "imageurl3"),
                }
            }));

            var results = _adapter.UpdatePointOfInterest(pointOfInterest, null, "en").Result;

            CollectionAssert.AreEqual(pointOfInterest.ImagesUrls.OrderBy(i => i).ToArray(), results.ImagesUrls.OrderBy(i => i).ToArray());
        }

        [TestMethod]
        public void GetPointsForIndexing_ShouldRemoveKklRoutes()
        {
            var memoryStream = new MemoryStream();
            var osmNamesDictionary = new Dictionary<string, List<ICompleteOsmGeo>>
            {
                {
                    "name",
                    new List<ICompleteOsmGeo>
                    {
                        new Node
                        {
                            Id = 10,
                            Tags = new TagsCollection
                            {
                                {"natural", "spring"},
                            }
                        },
                        new CompleteRelation
                        {
                            Tags = new TagsCollection
                            {
                                {"operator", "kkl"},
                                {"route", "mtb"}
                            },
                            Members = new[]
                            {
                                new CompleteRelationMember {Member = new CompleteWay(), Role = "outer"}
                            }
                        }
                    }
                },
            };
            _osmRepository.GetElementsWithName(memoryStream).Returns(osmNamesDictionary);
            _osmRepository.GetPointsWithNoNameByTags(memoryStream, Arg.Any<List<KeyValuePair<string, string>>>()).Returns(new List<Node>());

            var results = _adapter.GetPointsForIndexing(memoryStream).Result;

            Assert.AreEqual(1, results.Count);
        }
    }
}
