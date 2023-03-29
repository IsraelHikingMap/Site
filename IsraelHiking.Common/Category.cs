using System.Collections.Generic;
using System.Text.Json.Serialization;

namespace IsraelHiking.Common
{
    public class IconAndTags
    {
        [JsonPropertyName("iconColorCategory")]
        public IconColorCategory IconColorCategory { get; }
        [JsonPropertyName("tags")]
        public List<KeyValuePair<string, string>> Tags { get; }

        public IconAndTags(IconColorCategory iconColorCategory)
        {
            IconColorCategory = iconColorCategory;
            Tags = new List<KeyValuePair<string, string>>();
        }

        public IconAndTags(IconColorCategory iconColorCategory, string tagKey, string tagValue)
        {
            IconColorCategory = iconColorCategory;
            Tags = new List<KeyValuePair<string, string>>
            {
                new KeyValuePair<string, string>(tagKey, tagValue)
            };
        }

        public IconAndTags(IconColorCategory iconColorCategory, List<KeyValuePair<string, string>> tags)
        {
            IconColorCategory = iconColorCategory;
            Tags = tags;
        }
    }

    public class Category
    {
        [JsonPropertyName("name")]
        public string Name { get; set; }
        [JsonPropertyName("icon")]
        public string Icon { get; set; }
        [JsonPropertyName("color")]
        public string Color { get; set; }
        
        [JsonPropertyName("items")]
        public List<IconAndTags> Items { get; set; }

        public Category()
        {
            Items = new List<IconAndTags>();
        }
    }
}
