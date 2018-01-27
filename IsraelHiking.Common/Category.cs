using System.Collections.Generic;

namespace IsraelHiking.Common
{
    public class IconAndTags
    {
        public IconColorCategory IconColorCategory { get; }
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
        public string Name { get; set; }
        public string Icon { get; set; }
        public string Color { get; set; }

        public List<IconAndTags> Items { get; set; }

        public Category()
        {
            Items = new List<IconAndTags>();
        }
    }
}
