using System.Text.Json.Serialization;

namespace IsraelHiking.Common.Poi
{
    public class Reference
    {
        [JsonPropertyName("url")]
        public string Url { get; set; }
        [JsonPropertyName("sourceImageUrl")]
        public string SourceImageUrl { get; set; }
    }
}
