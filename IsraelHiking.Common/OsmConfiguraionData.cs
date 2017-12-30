namespace IsraelHiking.Common
{
    /// <summary>
    /// An object that describe how to connect to OSM
    /// </summary>
    public class OsmConfiguraionData
    {
        /// <summary>
        /// The OSM consumer key that was generated from OSM site
        /// </summary>
        public string ConsumerKey { get; set; }
        /// <summary>
        /// The OSM consumer secret that was generated from OSM site
        /// </summary>
        public string ConsumerSecret { get; set; }
        /// <summary>
        /// The OSM base address
        /// </summary>
        public string BaseAddress { get; set; }
    }
}
