namespace IsraelHiking.Common
{
    public class IconColorCategory
    {
        public string Icon { get; set; }
        public string Category { get; set; }
        public string Color { get; set; }
        public string Label { get; set; }

        public IconColorCategory() : this(string.Empty)
        {
        }

        public IconColorCategory(string icon, string category = Categories.NONE) : this(icon, category, "black", string.Empty)
        {
        }

        public IconColorCategory(string icon, string category, string color, string label)
        {
            Icon = icon;
            Category = category;
            Color = color;
            Label = label;
        }
    }
}