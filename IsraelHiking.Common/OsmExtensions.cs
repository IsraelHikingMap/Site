using System.Collections.Generic;
using System.Linq;
using OsmSharp.Tags;

namespace IsraelHiking.Common
{
    public static class OsmExtensions
    {
        public static string GetName(this TagsCollectionBase tags)
        {
            if (tags.ContainsKey(FeatureAttributes.NAME))
            {
                return tags[FeatureAttributes.NAME];
            }
            foreach (var tag in tags)
            {
                if (tag.Key.StartsWith(FeatureAttributes.NAME))
                {
                    return tag.Value;
                }
            }
            return string.Empty;
        }

        public static bool HasAny(this TagsCollectionBase myTags, List<KeyValuePair<string, string>> tags)
        {
            return tags.Any(t => myTags.ContainsKey(t.Key) &&
                                 myTags[t.Key].Equals(t.Value));
        }
    }
}
