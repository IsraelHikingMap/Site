using System.Text.Json.Serialization;

namespace IsraelHiking.Common;

public class IconColorCategory
{
    [JsonPropertyName("icon")]
    public string Icon { get; set; }
    [JsonPropertyName("category")]
    public string Category { get; set; }
    [JsonPropertyName("color")]
    public string Color { get; set; }
    [JsonPropertyName("label")]
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