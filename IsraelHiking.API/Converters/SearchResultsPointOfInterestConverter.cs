using System;
using IsraelHiking.API.Services.Poi;
using IsraelHiking.Common;
using IsraelHiking.Common.Extensions;
using IsraelHiking.Common.Poi;
using NetTopologySuite.Features;
using System.Linq;

namespace IsraelHiking.API.Converters
{
    /// <summary>
    /// This class converts location to point of interest
    /// </summary>
    [Obsolete("Not in use any more 5.2022")]
    public static class SearchResultsPointOfInterestConverter
    {
        private const string ID_SEPARATOR = "_";

        /// <summary>
        /// Main method to covert latitude-longitude coordinate to point of interest
        /// </summary>
        /// <param name="latLng"></param>
        /// <param name="displayName"></param>
        /// <returns></returns>
        [Obsolete("Not in use any more 5.2022")]
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
                Location = latLng,
                Description = string.Empty,
            };
        }
        
        /// <summary>
        /// Converts from ID to location
        /// </summary>
        /// <param name="id"></param>
        /// <returns></returns>
        [Obsolete("Not in use any more 5.2022")]
        public static LatLng GetLatLngFromId(string id)
        {
            return new LatLng(double.Parse(id.Split(ID_SEPARATOR).First()), double.Parse(id.Split(ID_SEPARATOR).Last()));
        }

        /// <summary>
        /// Converts from location to ID
        /// </summary>
        /// <param name="latLng"></param>
        /// <returns></returns>
        [Obsolete("Not in use any more 5.2022")]
        private static string GetIdFromLatLng(LatLng latLng)
        {
            return latLng.Lat.ToString("F4") + ID_SEPARATOR + latLng.Lng.ToString("F4");
        }
    }
}
