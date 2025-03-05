using IsraelHiking.Common.Api;
using System;
using System.Text.Json.Serialization;
using IsraelHiking.Common.Extensions;

namespace IsraelHiking.Common;

public class RebuildContext
{
    [JsonPropertyName("request")]
    public UpdateRequest Request { get; set; }
    [JsonConverter(typeof(DateTimeConverter))]
    [JsonPropertyName("startTime")]
    public DateTime StartTime { get; set; }
    [JsonPropertyName("succeeded")]
    public bool Succeeded { get; set; }
    [JsonPropertyName("errorMessage")]
    public string ErrorMessage { get; set; }
}