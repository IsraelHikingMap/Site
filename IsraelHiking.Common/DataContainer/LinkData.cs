using System.Text.Json.Serialization;

namespace IsraelHiking.Common.DataContainer
{
    public class LinkData
    {
        [JsonPropertyName("url")]
        public string Url { get; set; }
        [JsonPropertyName("text")]
        public string Text { get; set; }
        [JsonPropertyName("mimeType")]
        public string MimeType { get; set; }
    }
}
