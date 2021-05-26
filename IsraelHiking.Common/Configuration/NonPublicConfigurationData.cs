namespace IsraelHiking.Common.Configuration
{
    public class NonPublicConfigurationData
    {
        /// <summary>
        /// Wikimedia user name for public images upload
        /// </summary>
        public string WikiMediaUserName { get; set; }
        /// <summary>
        /// Wikimedia password for public images upload
        /// </summary>
        public string WikiMediaPassword { get; set; }
        /// <summary>
        /// Zanata user name for uploading and downloading translations
        /// </summary>
        public string ZanataUserName { get; set; }
        /// <summary>
        /// Zanata api key for uploading and downloading translations
        /// </summary>
        public string ZanataApiKey { get; set; }
        /// <summary>
        /// Imgur client ID for private images upload, mainly for private routes
        /// </summary>
        public string ImgurClientId { get; set; }
        /// <summary>
        /// Fovea API Key for server side receipt validation
        /// </summary>
        public string FoveaApiKey { get; set; }
    }
}
