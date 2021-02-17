using IsraelHiking.API.Services.Poi;
using IsraelHiking.Common;
using IsraelHiking.Common.DataContainer;
using IsraelHiking.Common.Extensions;
using IsraelHiking.Common.Poi;
using NetTopologySuite.Features;
using NetTopologySuite.Geometries;
using System.Linq;

namespace IsraelHiking.API.Converters
{
    /// <summary>
    /// This class converts location to point of interest
    /// </summary>
    public class SearchResultsPointOfInterestConverter
    {
        private const string ID_SEPARATOR = "_";

        /// <summary>
        /// Main method to covert latitude-longitude coordinate to point of interest
        /// </summary>
        /// <param name="latLng"></param>
        /// <param name="displayName"></param>
        /// <returns></returns>
        public static SearchResultsPointOfInterest FromLatlng(LatLng latLng, string displayName)
        {
            var id = GetIdFromLatLng(latLng);
            return new SearchResultsPointOfInterest
            {
                Id = id,
                DisplayName = string.IsNullOrWhiteSpace(displayName) ? id : displayName,
                Title = id,
                Source = Sources.COORDINATES,
                Icon = "icon-search",
                IconColor = "black",
                IsArea = false,
                IsRoute = false,
                IsEditable = false,
                HasExtraData = false,
                Location = latLng,
                SouthWest = latLng,
                NorthEast = latLng,
                Category = Categories.NONE,
                Description = string.Empty,
                ImagesUrls = new string[0],
                References = new Reference[0],
                DataContainer = new DataContainerPoco(),
                // HN TODO: add elevation?
                FeatureCollection = new FeatureCollection { new Feature(new Point(latLng.ToCoordinate()), new AttributesTable()) }
            };
        }
        
        /// <summary>
        /// Converts from ID to location
        /// </summary>
        /// <param name="id"></param>
        /// <returns></returns>
        public static LatLng GetLatLngFromId(string id)
        {
            return new LatLng(double.Parse(id.Split(ID_SEPARATOR).First()), double.Parse(id.Split(ID_SEPARATOR).Last()));
        }

        /// <summary>
        /// Converts from location to ID
        /// </summary>
        /// <param name="latLng"></param>
        /// <returns></returns>
        private static string GetIdFromLatLng(LatLng latLng)
        {
            return latLng.Lat.ToString("F4") + ID_SEPARATOR + latLng.Lng.ToString("F4");
        }

        /// <summary>
        /// Converts feature to Search results object
        /// </summary>
        /// <param name="feature"></param>
        /// <param name="language"></param>
        /// <returns></returns>
        public static SearchResultsPointOfInterest FromFeature(IFeature feature, string language)
        {
            var title = feature.GetTitle(language);
            var geoLocation = feature.GetLocation();
            var latLng = new LatLng(geoLocation.Y,geoLocation.X);
            var icon = feature.Attributes[FeatureAttributes.POI_ICON].ToString();
            if (string.IsNullOrWhiteSpace(icon))
            {
                icon = OsmPointsOfInterestAdapter.SEARCH_ICON;
            }
            return new SearchResultsPointOfInterest
            {
                Id = feature.Attributes[FeatureAttributes.ID].ToString(),
                Title = title,
                Category = feature.Attributes[FeatureAttributes.POI_CATEGORY].ToString(),
                Icon = icon,
                IconColor = feature.Attributes[FeatureAttributes.POI_ICON_COLOR].ToString(),
                Source = feature.Attributes[FeatureAttributes.POI_SOURCE].ToString(),
                Location = latLng,
                HasExtraData = feature.HasExtraData(language),
                NorthEast = new LatLng(feature.Geometry.EnvelopeInternal.MaxY, feature.Geometry.EnvelopeInternal.MaxX),
                SouthWest = new LatLng(feature.Geometry.EnvelopeInternal.MinY, feature.Geometry.EnvelopeInternal.MinX)
            };
        }
    }
}
