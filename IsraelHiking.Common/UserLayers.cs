using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace IsraelHiking.Common
{
    public class UserLayerData : LayerData
    {
        [Key]
        public long Id { get; set; }
        [ForeignKey("UserLayers")]
        public long UserLayersId { get; set; }
        
        public bool IsOverlay { get; set; }
    }

    public class UserLayers
    {
        [Key]
        public long Id { get; set; }
        public string OsmUserId { get; set; }
        
        public List<UserLayerData> Layers { get; set; }
    }
}
