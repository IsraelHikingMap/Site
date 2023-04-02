﻿using IsraelHiking.API.Controllers;
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
            _controller = new SearchController(_searchRepository);
        }

        [TestMethod]
        public void GetSearchResults_ShouldPassRequestToGateway_NoResultsFound()
        {
            var list = new List<IFeature>();
            var searchTerm = "searchTerm";
            _searchRepository.Search(searchTerm, Languages.ENGLISH).Returns(list);

            var results = _controller.GetSearchResults(searchTerm, Languages.ENGLISH).Result;

            Assert.IsNotNull(results);
            Assert.AreEqual(list.Count, results.Count());
        }
        
        [TestMethod]
        public void GetSearchResults_UsingQuotes_ShouldGetExactMatch()
        {
            var list = new List<IFeature>();
            var searchTerm = "\"searchTerm\"";
            _searchRepository.SearchExact(Arg.Any<string>(), Languages.ENGLISH).Returns(list);

            var results = _controller.GetSearchResults(searchTerm, Languages.ENGLISH).Result;

            Assert.IsNotNull(results);
            Assert.AreEqual(list.Count, results.Count());
            _searchRepository.Received(1).SearchExact(Arg.Any<string>(), Languages.ENGLISH);
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
            _searchRepository.SearchPlaces(place, Languages.ENGLISH).Returns(new List<IFeature>());
            _searchRepository.Search("searchTerm", Languages.ENGLISH).Returns(new List<IFeature> { featureInPlace });
            _searchRepository.GetContainers(featureLocation).Returns(new List<IFeature>());

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
            var featuresInsidePlace = new List<IFeature> { featureInPlace };
            _searchRepository.SearchPlaces(place, Languages.ENGLISH).Returns(new List<IFeature> {placeFeature});
            _searchRepository
                .SearchByLocation(Arg.Any<Coordinate>(), Arg.Any<Coordinate>(), "searchTerm", Languages.ENGLISH)
                .Returns(featuresInsidePlace);
            _searchRepository.GetContainers(featureLocation).Returns(new List<IFeature> { placeFeature });

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
            var featuresInsidePlace = new List<IFeature> { featureInPlace };
            _searchRepository.SearchPlaces(place, Languages.ENGLISH).Returns(new List<IFeature> { placeFeature });
            _searchRepository
                .SearchByLocation(Arg.Any<Coordinate>(), Arg.Any<Coordinate>(), "searchTerm", Languages.ENGLISH)
                .Returns(featuresInsidePlace);
            _searchRepository.GetContainers(featureLocation).Returns(new List<IFeature> { placeFeature });

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
            var featuresInsidePlace = new List<IFeature> { featureInPlace };
            _searchRepository.SearchPlaces(place, Languages.ENGLISH).Returns(new List<IFeature> { placeFeature });
            _searchRepository
                .SearchByLocation(Arg.Any<Coordinate>(), Arg.Any<Coordinate>(), "searchTerm", Languages.ENGLISH)
                .Returns(featuresInsidePlace);
            _searchRepository.GetContainers(featureLocation).Returns(new List<IFeature> { placeFeature });

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
            _searchRepository.Search(searchTerm, Languages.ENGLISH).Returns(new List<IFeature> { featureInPlace });
            _searchRepository.GetContainers(featureLocation).Returns(new List<IFeature> { placeFeature });

            var results = _controller.GetSearchResults(searchTerm, Languages.ENGLISH).Result;

            Assert.IsNotNull(results);
            Assert.IsTrue(results.First().DisplayName.Contains(place));
        }
    }
}
