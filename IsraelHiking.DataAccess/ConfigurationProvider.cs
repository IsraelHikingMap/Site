using System;
using System.Collections.Generic;
using System.Configuration;
using System.Linq;
using IsraelHiking.DataAccessInterfaces;

namespace IsraelHiking.DataAccess
{
    public class ConfigurationProvider : IConfigurationProvider
    {
        public int MaxCacheSize { get; }
        public int MaxSegmentsNumber { get; }
        public int MaxNumberOfPointsPerLine { get; }
        public double ClosestPointTolerance { get; }
        public double SimplificationTolerance { get; }
        public double MinimalMissingPartLength { get; }
        public double MinimalMissingSelfLoopPartLegth { get; }
        public double RadialSimplificationAngle { get; }
        public double MinimalSplitSimplificationTolerace { get; }
        public double MinimalSegmentLength { get; }
        public double SearchFactor { get; }
        public string BinariesFolder { get; }
        public Dictionary<string, string> ListingDictionary { get; }

        public ConfigurationProvider()
        {
            MaxCacheSize = GetValueOrDefault(nameof(MaxCacheSize), 200); // number 
            MaxSegmentsNumber = GetValueOrDefault(nameof(MaxSegmentsNumber), 40); // number
            MinimalSplitSimplificationTolerace = GetValueOrDefault(nameof(MinimalSplitSimplificationTolerace), 50); // meters
            MinimalSegmentLength = GetValueOrDefault(nameof(MinimalSegmentLength), 500); // meters
            ClosestPointTolerance = GetValueOrDefault(nameof(ClosestPointTolerance), 30); // meters
            SimplificationTolerance = GetValueOrDefault(nameof(SimplificationTolerance), 5); // meters
            MinimalMissingPartLength = GetValueOrDefault(nameof(MinimalMissingPartLength), 200); // meters
            MinimalMissingSelfLoopPartLegth = GetValueOrDefault(nameof(MinimalMissingSelfLoopPartLegth), ClosestPointTolerance); // meters
            MaxNumberOfPointsPerLine = GetValueOrDefault(nameof(MaxNumberOfPointsPerLine), 1000); // number
            RadialSimplificationAngle = GetValueOrDefault(nameof(RadialSimplificationAngle), 90); // degrees
            SearchFactor = GetValueOrDefault(nameof(SearchFactor), 0.5); // number
            BinariesFolder = GetValueOrDefault(nameof(BinariesFolder), string.Empty);

            const string listingKeyPrefix = "Listing_";
            ListingDictionary = ConfigurationManager.AppSettings.AllKeys
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
            return GetValueOrDefault(key, defaultValue, (str) => str);
        }
    }
}
