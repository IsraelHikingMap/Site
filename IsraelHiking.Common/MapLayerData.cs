using IsraelHiking.Common.DataContainer;
using System.Text.Json.Serialization;
using IsraelHiking.Common.Extensions;

namespace IsraelHiking.Common;

public class MapLayerData : LayerData
{
    [JsonPropertyName("id")]
    public string Id { get; set; }
    [JsonPropertyName("osmUserId")]
    [JsonConverter(typeof(AutoNumberToStringConverter))]
    public string OsmUserId { get; set; }
    [JsonPropertyName("isOverlay")]
    public bool IsOverlay { get; set; }
}