using System;
using System.Configuration;
using System.Linq;
using IsraelHiking.Common;
using IsraelHiking.DataAccessInterfaces;

namespace IsraelHiking.DataAccess
{
    public class Options : IOptions<ConfigurationData>
    {
        public ConfigurationData Value { get; }

        public Options()
        {
            Value = new ConfigurationData();
            Value.MaxCacheSize = GetValueOrDefault(nameof(ConfigurationData.MaxCacheSize), Value.MaxCacheSize);
            Value.MaxSegmentsNumber = GetValueOrDefault(nameof(ConfigurationData.MaxSegmentsNumber), Value.MaxSegmentsNumber);
            Value.MinimalSplitSimplificationTolerace = GetValueOrDefault(nameof(ConfigurationData.MinimalSplitSimplificationTolerace), Value.MinimalSplitSimplificationTolerace);
            Value.DistanceToExisitngLineMergeThreshold = GetValueOrDefault(nameof(ConfigurationData.DistanceToExisitngLineMergeThreshold), Value.DistanceToExisitngLineMergeThreshold);
            Value.MaximalProlongLineLength = GetValueOrDefault(nameof(ConfigurationData.MaximalProlongLineLength), Value.MaximalProlongLineLength);
            Value.MinimalSegmentLength = GetValueOrDefault(nameof(ConfigurationData.MinimalSegmentLength), Value.MinimalSegmentLength);
            Value.ClosestPointTolerance = GetValueOrDefault(nameof(ConfigurationData.ClosestPointTolerance), Value.ClosestPointTolerance);
            Value.SimplificationTolerance = GetValueOrDefault(nameof(ConfigurationData.SimplificationTolerance), Value.SimplificationTolerance);
            Value.MinimalMissingPartLength = GetValueOrDefault(nameof(ConfigurationData.MinimalMissingPartLength), Value.MinimalMissingPartLength);
            Value.MinimalMissingSelfLoopPartLegth = GetValueOrDefault(nameof(ConfigurationData.MinimalMissingSelfLoopPartLegth), Value.MinimalMissingSelfLoopPartLegth);
            Value.MaxNumberOfPointsPerLine = GetValueOrDefault(nameof(ConfigurationData.MaxNumberOfPointsPerLine), Value.MaxNumberOfPointsPerLine);
            Value.MaxLengthPerLine = GetValueOrDefault(nameof(ConfigurationData.MaxLengthPerLine), Value.MaxLengthPerLine);
            Value.RadialSimplificationAngle = GetValueOrDefault(nameof(ConfigurationData.RadialSimplificationAngle), Value.RadialSimplificationAngle);
            Value.SearchFactor = GetValueOrDefault(nameof(ConfigurationData.SearchFactor), Value.SearchFactor);
            Value.BinariesFolder = GetValueOrDefault(nameof(ConfigurationData.BinariesFolder), Value.BinariesFolder);
            Value.OsmConfiguraion = new OsmConfiguraionData {
                ConsumerKey = GetValueOrDefault(nameof(OsmConfiguraionData.ConsumerKey), Value.OsmConfiguraion.ConsumerKey),
                ConsumerSecret = GetValueOrDefault(nameof(OsmConfiguraionData.ConsumerSecret), Value.OsmConfiguraion.ConsumerSecret),
                BaseAddress = GetValueOrDefault(nameof(OsmConfiguraionData.BaseAddress), Value.OsmConfiguraion.BaseAddress)
            };
            const string listingKeyPrefix = "Listing_";
            Value.ListingDictionary = ConfigurationManager.AppSettings.AllKeys
                .Where(k => k.StartsWith(listingKeyPrefix))
                .ToDictionary(k => k.Substring(listingKeyPrefix.Length).ToLower(), k => ConfigurationManager.AppSettings[k]);
        }

        private T GetValueOrDefault<T>(string key, T defaultValue, Func<string, T> convertionDelegate)
        {
            if (ConfigurationManager.AppSettings.AllKeys.Contains(key))
            {
                return convertionDelegate(ConfigurationManager.AppSettings[key]);
            }
            return defaultValue;
        }

        private int GetValueOrDefault(string key, int defaultValue)
        {
            return GetValueOrDefault(key, defaultValue, int.Parse);
        }

        private double GetValueOrDefault(string key, double defaultValue)
        {
            return GetValueOrDefault(key, defaultValue, double.Parse);
        }

        private string GetValueOrDefault(string key, string defaultValue)
        {
            return GetValueOrDefault(key, defaultValue, str => str);
        }
    }
}
