﻿using IsraelHiking.API.Controllers;
using IsraelHiking.API.Converters.CoordinatesParsers;
using IsraelHiking.Common;
using IsraelHiking.Common.Extensions;
using IsraelHiking.DataAccessInterfaces.Repositories;
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
        private ISearchRepository _searchRepository;
        private SearchController _controller;

        [TestInitialize]
        public void TestInitialize()
        {
            _searchRepository = Substitute.For<ISearchRepository>();
            _controller = new SearchController(_searchRepository, new List<ICoordinatesParser> { new DecimalLatLonParser() });
        }

        [TestMethod]
        public void GetSearchResults_ShouldPassRequestToGateway_NoResultsFound()
        {
            var list = new List<Feature>();
            var searchTerm = "searchTerm";
            _searchRepository.Search(searchTerm, Languages.ENGLISH).Returns(list);

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
                {FeatureAttributes.POI_CATEGORY, Categories.HISTORIC},
                {FeatureAttributes.POI_SOURCE, Sources.OSM},
                {FeatureAttributes.POI_ICON, string.Empty},
                {FeatureAttributes.POI_ICON_COLOR, "black"},
                {FeatureAttributes.ID, "id"}
            });
            featureInPlace.SetTitles();
            featureInPlace.SetLocation(featureLocation);
            var featuresInsidePlace = new List<Feature> { featureInPlace };
            _searchRepository.SearchPlaces(place, Languages.ENGLISH).Returns(new List<Feature>());
            _searchRepository.Search("searchTerm", Languages.ENGLISH).Returns(new List<Feature> { featureInPlace });
            _searchRepository.GetContainers(featureLocation).Returns(new List<Feature>());

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
                {FeatureAttributes.POI_CATEGORY, Categories.HISTORIC},
                {FeatureAttributes.POI_SOURCE, Sources.OSM},
                {FeatureAttributes.POI_ICON, string.Empty},
                {FeatureAttributes.POI_ICON_COLOR, "black"},
                {FeatureAttributes.ID, "id"}
            });
            featureInPlace.SetTitles();
            featureInPlace.SetLocation(featureLocation);
            var featuresInsidePlace = new List<Feature> { featureInPlace };
            _searchRepository.SearchPlaces(place, Languages.ENGLISH).Returns(new List<Feature> {placeFeature});
            _searchRepository
                .SearchByLocation(Arg.Any<Coordinate>(), Arg.Any<Coordinate>(), "searchTerm", Languages.ENGLISH)
                .Returns(featuresInsidePlace);
            _searchRepository.GetContainers(featureLocation).Returns(new List<Feature> { placeFeature });

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
                    {FeatureAttributes.POI_CATEGORY, Categories.HISTORIC},
                    {FeatureAttributes.POI_SOURCE, Sources.OSM},
                    {FeatureAttributes.POI_ICON, string.Empty},
                    {FeatureAttributes.POI_ICON_COLOR, "black"},
                    {FeatureAttributes.ID, "id"}
                }
            );
            featureInPlace.SetTitles();
            featureInPlace.SetLocation(featureLocation);
            var featuresInsidePlace = new List<Feature> { featureInPlace };
            _searchRepository.SearchPlaces(place, Languages.ENGLISH).Returns(new List<Feature> { placeFeature });
            _searchRepository
                .SearchByLocation(Arg.Any<Coordinate>(), Arg.Any<Coordinate>(), "searchTerm", Languages.ENGLISH)
                .Returns(featuresInsidePlace);
            _searchRepository.GetContainers(featureLocation).Returns(new List<Feature> { placeFeature });

            var results = _controller.GetSearchResults(searchTerm, Languages.ENGLISH).Result.ToList();

            Assert.IsNotNull(results);
            Assert.AreEqual(featuresInsidePlace.Count, results.Count);
            Assert.IsTrue(results.First().DisplayName.Contains(place));
        }

        [TestMethod]
        public void GetSearchResults_GeometryCollectionNoContainers_ShouldNotFail()
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
                    new Point(featureLocation),
                    new LineString(new [] { new Coordinate(0,0), new Coordinate(3,3) })
                }), new AttributesTable
                {
                    {FeatureAttributes.NAME, "name"},
                    {FeatureAttributes.POI_CATEGORY, Categories.HISTORIC},
                    {FeatureAttributes.POI_SOURCE, Sources.OSM},
                    {FeatureAttributes.POI_ICON, string.Empty},
                    {FeatureAttributes.POI_ICON_COLOR, "black"},
                    {FeatureAttributes.ID, "id"}
                }
            );
            featureInPlace.SetTitles();
            featureInPlace.SetLocation(featureLocation);
            var featuresInsidePlace = new List<Feature> { featureInPlace };
            _searchRepository.SearchPlaces(place, Languages.ENGLISH).Returns(new List<Feature> { placeFeature });
            _searchRepository
                .SearchByLocation(Arg.Any<Coordinate>(), Arg.Any<Coordinate>(), "searchTerm", Languages.ENGLISH)
                .Returns(featuresInsidePlace);
            _searchRepository.GetContainers(featureLocation).Returns(new List<Feature> { placeFeature });

            var results = _controller.GetSearchResults(searchTerm, Languages.ENGLISH).Result.ToList();

            Assert.IsNotNull(results);
            Assert.AreEqual(featuresInsidePlace.Count, results.Count);
            Assert.IsFalse(results.First().DisplayName.Contains(place));
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
                {FeatureAttributes.POI_CATEGORY, Categories.HISTORIC},
                {FeatureAttributes.POI_SOURCE, Sources.OSM},
                {FeatureAttributes.POI_ICON, string.Empty},
                {FeatureAttributes.POI_ICON_COLOR, "black"},
                {FeatureAttributes.ID, "id"}
            });
            featureInPlace.SetTitles();
            featureInPlace.SetLocation(featureLocation);
            _searchRepository.Search(searchTerm, Languages.ENGLISH).Returns(new List<Feature> { featureInPlace });
            _searchRepository.GetContainers(featureLocation).Returns(new List<Feature> { placeFeature });

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
