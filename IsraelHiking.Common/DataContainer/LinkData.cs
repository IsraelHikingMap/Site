using Newtonsoft.Json;

namespace IsraelHiking.Common.DataContainer
{
    public class LinkData
    {
        [JsonProperty("url")]
        public string Url { get; set; }
        [JsonProperty("text")]
        public string Text { get; set; }
        [JsonProperty("mimeType")]
        public string MimeType { get; set; }
    }
}
