namespace IsraelHiking.Common
{
    public class IconColorCategory
    {
        public string Icon { get; set; }
        public string Category { get; set; }
        public string Color { get; set; }

        public IconColorCategory() : this(string.Empty)
        {
        }

        public IconColorCategory(string icon) : this(icon, Categories.NONE)
        {
        }

        public IconColorCategory(string icon, string category) : this(icon, category, "black")
        {
        }

        public IconColorCategory(string icon, string category, string color)
        {
            Icon = icon;
            Category = category;
            Color = color;
        }
    }
}