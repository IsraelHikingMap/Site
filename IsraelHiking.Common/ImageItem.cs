using System.Collections.Generic;

namespace IsraelHiking.Common
{
    public class ImageItem
    {
        /// <summary>
        /// Used as a key
        /// </summary>
        public string Hash { get; set; }
        public List<string> ImageUrls { get; set; }
        public string Thumbnail { get; set; }
        
    }
}
