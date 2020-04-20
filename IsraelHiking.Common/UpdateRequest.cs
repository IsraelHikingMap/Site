namespace IsraelHiking.Common
{
    public class UpdateRequest
    {
        /// <summary>
        /// Download daily OSM file, this is done if update OSM is true
        /// </summary>
        public bool DownloadOsmFile { get; set; }
        /// <summary>
        /// Updates OSM file to be the lastet.
        /// </summary>
        public bool UpdateOsmFile { get; set; }
        /// <summary>
        /// Update points of interest database
        /// </summary>
        public bool PointsOfInterest { get; set; }
        /// <summary>
        /// Update highway database
        /// </summary>
        public bool Highways { get; set; }
        /// <summary>
        /// Updates images mirror
        /// </summary>
        public bool Images { get; set; }
        /// <summary>
        /// Update site map xml file and offline points of interest file
        /// </summary>
        public bool SiteMap { get; set; }
        
    }
}
