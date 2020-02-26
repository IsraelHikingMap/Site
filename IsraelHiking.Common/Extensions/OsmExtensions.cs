using System.Collections.Generic;
using System.Linq;
using OsmSharp;
using OsmSharp.Complete;
using OsmSharp.Tags;

namespace IsraelHiking.Common.Extensions
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

        public static string GetId(this ICompleteOsmGeo osmObject)
        {
            return osmObject.Type.ToString().ToLower() + "_" + osmObject.Id;
        }

        public static string GetId(this OsmGeo osmObject)
        {
            return osmObject.Type.ToString().ToLower() + "_" + osmObject.Id;
        }
    }
}
