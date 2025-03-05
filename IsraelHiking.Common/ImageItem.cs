using System.Collections.Generic;
using System.Text.Json.Serialization;

namespace IsraelHiking.Common;

public class ImageItem
{
    /// <summary>
    /// Used as a key
    /// </summary>
    [JsonPropertyName("hash")]
    public string Hash { get; set; }
    [JsonPropertyName("imageUrls")]
    public List<string> ImageUrls { get; set; }
    [JsonPropertyName("thumbnail")]
    public string Thumbnail { get; set; }
        
}