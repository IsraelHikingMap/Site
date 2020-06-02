using IsraelHiking.Common.DataContainer;
using Newtonsoft.Json;
using System;

namespace IsraelHiking.Common
{
    public class ShareUrl
    {
        [JsonProperty("id")]
        public string Id { get; set; }
        [JsonProperty("title")]
        public string Title { get; set; }
        [JsonProperty("description")]
        public string Description { get; set; }
        [JsonProperty("osmUserId")]
        public string OsmUserId { get; set; }
        [JsonProperty("viewsCount")]
        public int ViewsCount { get; set; }
        [JsonProperty("creationDate")]
        public DateTime CreationDate { get; set; }
        [JsonProperty("lastViewed")]
        public DateTime LastViewed { get; set; }

        [JsonProperty("dataContainer")]
        public DataContainerPoco DataContainer { get; set; }
    }
}
