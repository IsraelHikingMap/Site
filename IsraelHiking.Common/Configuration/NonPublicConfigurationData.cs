namespace IsraelHiking.Common.Configuration;

public class NonPublicConfigurationData
{
    /// <summary>
    /// Imgur client ID for private images upload, mainly for private routes
    /// </summary>
    public string ImgurClientId { get; set; }
    /// <summary>
    /// Fovea API Key for server side receipt validation
    /// </summary>
    public string FoveaApiKey { get; set; }
    /// <summary>
    /// RevenueCat API key for server side validation
    /// </summary>
    public string RevenueCatApiKey { get; set; }
}