using IsraelHiking.API.Controllers;
using IsraelHiking.API.Converters.CoordinatesParsers;
using IsraelHiking.Common;
using IsraelHiking.Common.Extensions;
using IsraelHiking.DataAccessInterfaces;
using Microsoft.VisualStudio.TestTools.UnitTesting;
using NetTopologySuite.Features;
using NetTopologySuite.Geometries;
using NSubstitute;
using System.Collections.Generic;
using System.Linq;

namespace IsraelHiking.API.Tests.Controllers
{
    [TestClass]
    public class SearchControllerTests
    {
        private IElasticSearchGateway _elasticSearchGateway;
        private SearchController _controller;

        [TestInitialize]
        public void TestInitialize()
        {
            _elasticSearchGateway = Substitute.For<IElasticSearchGateway>();
            _controller = new SearchController(_elasticSearchGateway, new List<ICoordinatesParser> { new DecimalLatLonParser() });
        }

        [TestMethod]
        public void GetSearchResults_ShouldPassRequestToGateway_NoResultsFound()
        {
            var list = new List<Feature>();
            var searchTerm = "searchTerm";
            _elasticSearchGateway.Search(searchTerm, Languages.ENGLISH).Returns(list);

            var results = _controller.GetSearchResults(searchTerm, Languages.ENGLISH).Result;

            Assert.IsNotNull(results);
            Assert.AreEqual(list.Count, results.Count());
        }

        [TestMethod]
        public void GetSearchResults_WithPlaceNameThatDoNotExist_ShouldReturnRegularResults()
        {
            var place = "place";
            var searchTerm = "searchTerm, " + place;
            var featureLocation = new Coordinate(0.5, 0.5);
            var featureInPlace = new Feature(new Point(featureLocation), new AttributesTable
            {
                {FeatureAttributes.NAME, "name"},
                {
                    FeatureAttributes.POI_GEOLOCATION,
                    new AttributesTable {{FeatureAttributes.LAT, featureLocation.Y}, {FeatureAttributes.LON, featureLocation.X} }
                },
                {FeatureAttributes.POI_CATEGORY, Categories.HISTORIC},
                {FeatureAttributes.POI_SOURCE, Sources.OSM},
                {FeatureAttributes.POI_ICON, string.Empty},
                {FeatureAttributes.POI_ICON_COLOR, "black"},
                {FeatureAttributes.ID, "id"}
            });
            featureInPlace.SetTitles();
            var featuresInsidePlace = new List<Feature> { featureInPlace };
            _elasticSearchGateway.SearchPlaces(place, Languages.ENGLISH).Returns(new List<Feature>());
            _elasticSearchGateway.Search("searchTerm", Languages.ENGLISH).Returns(new List<Feature> { featureInPlace });
            _elasticSearchGateway.GetContainers(featureLocation).Returns(new List<Feature>());

            var results = _controller.GetSearchResults(searchTerm, Languages.ENGLISH).Result.ToList();

            Assert.IsNotNull(results);
            Assert.AreEqual(featuresInsidePlace.Count, results.Count);
            Assert.IsFalse(results.First().DisplayName.Contains(place));
        }

        [TestMethod]
        public void GetSearchResults_WithPlaceName_ShouldSearchOnlyPlacesInThatPlace()
        {
            var place = "place";
            var searchTerm = "searchTerm, " + place;
            var placeFeature = new Feature(new Polygon(new LinearRing(new[]
            {
                new Coordinate(0, 0),
                new Coordinate(0, 1),
                new Coordinate(2, 0),
                new Coordinate(0, 0)
            })), new AttributesTable
            {
                {FeatureAttributes.NAME, place},
                {FeatureAttributes.ID, "place_id" }
            });
            placeFeature.SetTitles();
            var featureLocation = new Coordinate(0.5, 0.5);
            var featureInPlace = new Feature(new Point(featureLocation), new AttributesTable
            {
                {FeatureAttributes.NAME, "name"},
                {
                    FeatureAttributes.POI_GEOLOCATION,
                    new AttributesTable {{FeatureAttributes.LAT, featureLocation.Y}, {FeatureAttributes.LON, featureLocation.X} }
                },
                {FeatureAttributes.POI_CATEGORY, Categories.HISTORIC},
                {FeatureAttributes.POI_SOURCE, Sources.OSM},
                {FeatureAttributes.POI_ICON, string.Empty},
                {FeatureAttributes.POI_ICON_COLOR, "black"},
                {FeatureAttributes.ID, "id"}
            });
            featureInPlace.SetTitles();
            var featuresInsidePlace = new List<Feature> { featureInPlace };
            _elasticSearchGateway.SearchPlaces(place, Languages.ENGLISH).Returns(new List<Feature> {placeFeature});
            _elasticSearchGateway
                .SearchByLocation(Arg.Any<Coordinate>(), Arg.Any<Coordinate>(), "searchTerm", Languages.ENGLISH)
                .Returns(featuresInsidePlace);
            _elasticSearchGateway.GetContainers(featureLocation).Returns(new List<Feature> { placeFeature });

            var results = _controller.GetSearchResults(searchTerm, Languages.ENGLISH).Result.ToList();

            Assert.IsNotNull(results);
            Assert.AreEqual(featuresInsidePlace.Count, results.Count);
            Assert.IsTrue(results.First().DisplayName.Contains(place));
        }

        [TestMethod]
        public void GetSearchResults_GeometryCollection_ShouldNotFail()
        {
            var place = "place";
            var searchTerm = "searchTerm, " + place;
            var placeFeature = new Feature(new Polygon(new LinearRing(new[]
            {
                new Coordinate(0, 0),
                new Coordinate(0, 1),
                new Coordinate(2, 0),
                new Coordinate(0, 0)
            })), new AttributesTable
            {
                {FeatureAttributes.NAME, place},
                {FeatureAttributes.ID, "place_id" }
            });
            placeFeature.SetTitles();
            var featureLocation = new Coordinate(0.5, 0.5);
            var featureInPlace = new Feature(new GeometryCollection(new Geometry[]
                {
                    new Point(featureLocation)
                }), new AttributesTable
                {
                    {FeatureAttributes.NAME, "name"},
                    {
                        FeatureAttributes.POI_GEOLOCATION,
                        new AttributesTable
                            {{FeatureAttributes.LAT, featureLocation.Y}, {FeatureAttributes.LON, featureLocation.X}}
                    },
                    {FeatureAttributes.POI_CATEGORY, Categories.HISTORIC},
                    {FeatureAttributes.POI_SOURCE, Sources.OSM},
                    {FeatureAttributes.POI_ICON, string.Empty},
                    {FeatureAttributes.POI_ICON_COLOR, "black"},
                    {FeatureAttributes.ID, "id"}
                }
            );
            featureInPlace.SetTitles();
            var featuresInsidePlace = new List<Feature> { featureInPlace };
            _elasticSearchGateway.SearchPlaces(place, Languages.ENGLISH).Returns(new List<Feature> { placeFeature });
            _elasticSearchGateway
                .SearchByLocation(Arg.Any<Coordinate>(), Arg.Any<Coordinate>(), "searchTerm", Languages.ENGLISH)
                .Returns(featuresInsidePlace);
            _elasticSearchGateway.GetContainers(featureLocation).Returns(new List<Feature> { placeFeature });

            var results = _controller.GetSearchResults(searchTerm, Languages.ENGLISH).Result.ToList();

            Assert.IsNotNull(results);
            Assert.AreEqual(featuresInsidePlace.Count, results.Count);
            Assert.IsTrue(results.First().DisplayName.Contains(place));
        }

        [TestMethod]
        public void GetSearchResults_ContainerHasNoName_ShouldNotIAddItToDisplayName()
        {
            var place = "place";
            var searchTerm = "searchTerm";
            var placeFeature = new Feature(new Polygon(new LinearRing(new[]
            {
                new Coordinate(0, 0),
                new Coordinate(0, 1),
                new Coordinate(2, 0),
                new Coordinate(0, 0)
            })), new AttributesTable
            {
                {FeatureAttributes.NAME, place},
                {FeatureAttributes.ID, "place_id" }
            });
            placeFeature.SetTitles();
            var featureLocation = new Coordinate(0.5, 0.5);
            var featureInPlace = new Feature(new Point(featureLocation), new AttributesTable
            {
                {FeatureAttributes.NAME, "name"},
                {
                    FeatureAttributes.POI_GEOLOCATION,
                    new AttributesTable {{FeatureAttributes.LAT, featureLocation.Y}, {FeatureAttributes.LON, featureLocation.X} }
                },
                {FeatureAttributes.POI_CATEGORY, Categories.HISTORIC},
                {FeatureAttributes.POI_SOURCE, Sources.OSM},
                {FeatureAttributes.POI_ICON, string.Empty},
                {FeatureAttributes.POI_ICON_COLOR, "black"},
                {FeatureAttributes.ID, "id"}
            });
            featureInPlace.SetTitles();
            _elasticSearchGateway.Search(searchTerm, Languages.ENGLISH).Returns(new List<Feature> { featureInPlace });
            _elasticSearchGateway.GetContainers(featureLocation).Returns(new List<Feature> { placeFeature });

            var results = _controller.GetSearchResults(searchTerm, Languages.ENGLISH).Result;

            Assert.IsNotNull(results);
            Assert.IsTrue(results.First().DisplayName.Contains(place));
        }

        [TestMethod]
        public void GetSearchResultsForSingleNumber_ShouldReturnCoordinatesPoi()
        {
            var results = _controller.GetSearchResults("+32, 35", Languages.HEBREW).Result;
            Assert.IsNotNull(results);
            Assert.AreEqual(Sources.COORDINATES, results.First().Source);
        }
    }
}
