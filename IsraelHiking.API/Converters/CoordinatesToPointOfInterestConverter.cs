using System.Collections.Generic;
using System.Linq;
using IsraelHiking.Common;
using IsraelHiking.Common.Poi;

namespace IsraelHiking.API.Converters
{
    /// <summary>
    /// This class converts location to point of interest
    /// </summary>
    public class CoordinatesToPointOfInterestConverter
    {
        private const string ID_SEPARATOR = "_";

        /// <summary>
        /// Main method to covert latitude-longitude coordinate to point of interest
        /// </summary>
        /// <param name="latLng"></param>
        /// <param name="displayName"></param>
        /// <returns></returns>
        public static SearchResultsPointOfInterest Convert(LatLng latLng, string displayName)
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
                Rating = new Rating { Raters = new List<Rater>() },
                Description = string.Empty,
                ImagesUrls = new string[0],
                References = new Reference[0],
                DataContainer = new DataContainer()
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
    }
}
