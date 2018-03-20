using System.Collections.Generic;
using Newtonsoft.Json;

namespace IsraelHiking.Common
{
    public class MapLayerData : LayerData
    {
        [JsonProperty("id")]
        public string Id { get; set; }
        [JsonProperty("osmUserId")]
        public string OsmUserId { get; set; }
        [JsonProperty("isOverlay")]
        public bool IsOverlay { get; set; }
    }
}
