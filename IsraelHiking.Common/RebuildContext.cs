using IsraelHiking.Common.Api;
using System;
using System.Text.Json.Serialization;

namespace IsraelHiking.Common
{
    public class RebuildContext
    {
        [JsonPropertyName("request")]
        public UpdateRequest Request { get; set; }
        [JsonPropertyName("startTime")]
        public DateTime StartTime { get; set; }
        [JsonPropertyName("succeeded")]
        public bool Succeeded { get; set; }
        [JsonPropertyName("errorMessage")]
        public string ErrorMessage { get; set; }
    }
}
