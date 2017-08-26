using System.Collections.Generic;
using System.Collections.ObjectModel;
using System.IO;
using System.Linq;
using System.Text.RegularExpressions;
using System.Threading.Tasks;
using GeoAPI.Geometries;
using IsraelHiking.API.Executors;
using IsraelHiking.Common;
using IsraelHiking.DataAccessInterfaces;
using NetTopologySuite.Features;
using NetTopologySuite.Geometries;
using OsmSharp;
using OsmSharp.Tags;

namespace IsraelHiking.API.Services.Poi
{
    /// <summary>
    /// Points of interest adapter for OSM data
    /// </summary>
    public class OsmPointsOfInterestAdapter : BasePoiAdapter, IPointsOfInterestAdapter
    {
        private readonly IElasticSearchGateway _elasticSearchGateway;
        private readonly IHttpGatewayFactory _httpGatewayFactory;
        private readonly IOsmGeoJsonPreprocessorExecutor _osmGeoJsonPreprocessorExecutor;
        private readonly IOsmRepository _osmRepository;

        /// <summary>
        /// Adapter's constructor
        /// </summary>
        /// <param name="elasticSearchGateway"></param>
        /// <param name="elevationDataStorage"></param>
        /// <param name="httpGatewayFactory"></param>
        /// <param name="osmGeoJsonPreprocessorExecutor"></param>
        /// <param name="osmRepository"></param>
        public OsmPointsOfInterestAdapter(IElasticSearchGateway elasticSearchGateway, 
            IElevationDataStorage elevationDataStorage,
            IHttpGatewayFactory httpGatewayFactory, 
            IOsmGeoJsonPreprocessorExecutor osmGeoJsonPreprocessorExecutor, 
            IOsmRepository osmRepository) : base(elevationDataStorage)
        {
            _elasticSearchGateway = elasticSearchGateway;
            _httpGatewayFactory = httpGatewayFactory;
            _osmGeoJsonPreprocessorExecutor = osmGeoJsonPreprocessorExecutor;
            _osmRepository = osmRepository;
        }
        /// <inheritdoc />
        public string Source => Sources.OSM;

        /// <inheritdoc />
        public async Task<PointOfInterest[]> GetPointsOfInterest(Coordinate northEast, Coordinate southWest, string[] categories, string language)
        {
            var features = await _elasticSearchGateway.GetPointsOfInterest(northEast, southWest, categories);
            return await Task.WhenAll(features.Select(f => ConvertToPoiItem<PointOfInterest>(f, language)));
        }

        /// <inheritdoc />
        public async Task<PointOfInterestExtended> GetPointOfInterestById(string id, string language)
        {
            var feature = await _elasticSearchGateway.GetPointOfInterestById(id, Sources.OSM);
            var poiItem = await ConvertToPoiItem<PointOfInterestExtended>(feature, language);
            AddExtendedData(poiItem, feature, language);
            return poiItem;
        }

        /// <inheritdoc />
        public async Task UpdatePointOfInterest(PointOfInterestExtended pointOfInterest, TokenAndSecret tokenAndSecret, string language)
        {
            var osmGateway = _httpGatewayFactory.CreateOsmGateway(tokenAndSecret);
            var feature = await _elasticSearchGateway.GetPointOfInterestById(pointOfInterest.Id, Sources.OSM);
            SetAtttibuteByLanguage(feature.Attributes, FeatureAttributes.DESCRIPTION, pointOfInterest.Description, language);
            await _elasticSearchGateway.UpdateNamesData(feature);
            var id = feature.Attributes[FeatureAttributes.ID].ToString();
            OsmGeo osmGeo;
            if (feature.Geometry is Point)
            {
                osmGeo = await osmGateway.GetNode(id);
            }
            else if (feature.Geometry is LineString || feature.Geometry is Polygon)
            {
                osmGeo = await osmGateway.GetWay(id);
            }
            else
            {
                osmGeo = await osmGateway.GetRelation(id);
            }
            SetTagByLanguage(osmGeo.Tags, FeatureAttributes.DESCRIPTION, pointOfInterest.Description, language);

            var changesetId = await osmGateway.CreateChangeset("Update POI interface from IHM site.");
            await osmGateway.UpdateElement(changesetId, osmGeo);
            await osmGateway.CloseChangeset(changesetId);
        }

        private void SetAtttibuteByLanguage(IAttributesTable attributes, string key, string value, string language)
        {
            language = GetLanguage(value, language);
            var keyWithLanguage = key + ":" + language;
            if (string.IsNullOrWhiteSpace(value) && attributes.GetNames().Contains(keyWithLanguage))
            {
                attributes.DeleteAttribute(keyWithLanguage);
                return;
            }
            if (attributes.GetNames().Contains(keyWithLanguage))
            {
                attributes[keyWithLanguage] = value;
                return;
            }
            attributes.AddAttribute(keyWithLanguage, value);
        }

        private void SetTagByLanguage(TagsCollectionBase tags, string key, string value, string language)
        {
            language = GetLanguage(value, language);
            var keyWithLanguage = key + ":" + language;
            if (string.IsNullOrWhiteSpace(value) && tags.ContainsKey(keyWithLanguage))
            {
                tags.RemoveKey(keyWithLanguage);
                return;
            }
            if (tags.ContainsKey(keyWithLanguage))
            {
                tags[keyWithLanguage] = value;
                return;
            }
            tags.Add(new Tag(keyWithLanguage, value));
        }


        private string GetLanguage(string value, string language)
        {
            if (string.IsNullOrWhiteSpace(value))
            {
                return language;
            }
            language = "he";
            if (HasHebrewCharacters(value) == false)
            {
                language = "en";
            }
            return language;
        }

        private bool HasHebrewCharacters(string words)
        {
            return Regex.Match(words, @"^[^a-zA-Z]*[\u0591-\u05F4]").Success;
        }

        public async Task<List<Feature>> GetPointsForIndexing(Stream memoryStream)
        {
            var osmNamesDictionary = await _osmRepository.GetElementsWithName(memoryStream);
            var geoJsonNamesDictionary = _osmGeoJsonPreprocessorExecutor.Preprocess(osmNamesDictionary);
            return geoJsonNamesDictionary.Values.SelectMany(v => v).ToList();
        }
    }
}
