
using System.Linq;
using IsraelHiking.Common;
using IsraelHiking.Common.Extensions;
using NetTopologySuite.Features;

namespace IsraelHiking.API.Services.Poi
{
    /// <summary>
    /// This class is responsible for manipulating tags and website url with emphasis to wikipedia
    /// </summary>
    public static class WebsiteUrlFeatureHelper
    {
        /// <summary>
        /// This is the main function to get the website from a feature
        /// </summary>
        /// <param name="feature"></param>
        /// <param name="language"></param>
        /// <returns></returns>
        public static string GetWebsiteUrl(IFeature feature, string language)
        {
            return feature.Attributes.Exists(FeatureAttributes.WEBSITE)
                ? feature.Attributes[FeatureAttributes.WEBSITE].ToString()
                : string.Empty;
        }

        /// <summary>
        /// This function will get a wikipedia URL if the feature has related tags, or a regular one if it doesn't
        /// </summary>
        /// <param name="feature">The feature</param>
        /// <param name="language">The required language</param>
        /// <returns>A url, empty string if none were found</returns>
        public static string GetWikipediaUrl(IFeature feature, string language)
        {
            var title = feature.Attributes.GetWikipediaTitle(language);
            if (string.IsNullOrWhiteSpace(title))
            {
                return GetWebsiteUrl(feature, language);
            }
            return $"https://{language}.wikipedia.org/wiki/{title.Trim().Replace(" ", "_")}";
        }

        
    }
}
