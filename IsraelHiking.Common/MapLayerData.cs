using IsraelHiking.Common.DataContainer;
using System.Text.Json.Serialization;

namespace IsraelHiking.Common
{
    public class MapLayerData : LayerData
    {
        [JsonPropertyName("id")]
        public string Id { get; set; }
        [JsonPropertyName("osmUserId")]
        public string OsmUserId { get; set; }
        [JsonPropertyName("isOverlay")]
        public bool IsOverlay { get; set; }
    }
}
