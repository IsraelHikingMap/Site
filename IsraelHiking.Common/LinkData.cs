using System;
using System.Collections.Generic;
using System.Net.Sockets;
using System.Text;
using Newtonsoft.Json;

namespace IsraelHiking.Common
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
