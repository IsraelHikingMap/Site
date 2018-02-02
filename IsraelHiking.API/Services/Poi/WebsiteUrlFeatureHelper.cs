
using System.Linq;
using IsraelHiking.Common;
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
            return feature.Attributes.GetNames().Contains(FeatureAttributes.WEBSITE)
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
            var title = GetWikipediaTitle(feature.Attributes, language);
            if (string.IsNullOrWhiteSpace(title))
            {
                return GetWebsiteUrl(feature, language);
            }
            return $"https://{language}.wikipedia.org/wiki/{title.Trim().Replace(" ", "_")}";
        }

        /// <summary>
        /// This is an extention method to attribute table to get the wikipedia page title by language
        /// </summary>
        /// <param name="attributes">The attributes table</param>
        /// <param name="language">The required language</param>
        /// <returns>The page title, empty if none exist</returns>
        public static string GetWikipediaTitle(this IAttributesTable attributes, string language)
        {
            if (!attributes.GetNames().Any(n => n.StartsWith(FeatureAttributes.WIKIPEDIA)))
            {
                return string.Empty;
            }
            var wikiWithLanguage = FeatureAttributes.WIKIPEDIA + ":" + language;
            if (attributes.Exists(wikiWithLanguage))
            {
                return attributes[wikiWithLanguage].ToString();
            }
            if (!attributes.Exists(FeatureAttributes.WIKIPEDIA))
            {
                return string.Empty;
            }
            var titleWithLanguage = attributes[FeatureAttributes.WIKIPEDIA].ToString();
            var languagePrefix = language + ":";
            if (titleWithLanguage.StartsWith(languagePrefix))
            {
                return titleWithLanguage.Substring(languagePrefix.Length);
            }
            return string.Empty;
        }
    }
}
