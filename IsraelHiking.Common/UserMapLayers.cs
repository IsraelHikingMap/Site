using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using Newtonsoft.Json;

namespace IsraelHiking.Common
{
    public class UserMapLayers
    {
        [JsonProperty("osmUserId")]
        public string OsmUserId { get; set; }
        [JsonProperty("layers")]
        public List<MapLayerData> Layers { get; set; }

        public UserMapLayers()
        {
            Layers = new List<MapLayerData>();
        }
    }

    public class MapLayerData : LayerData
    {
        [JsonProperty("isOverlay")]
        public bool IsOverlay { get; set; }
    }
}
