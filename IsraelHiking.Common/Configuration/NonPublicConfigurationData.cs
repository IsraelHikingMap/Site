namespace IsraelHiking.Common.Configuration;

public class NonPublicConfigurationData
{
    /// <summary>
    /// Wikimedia username for public images upload
    /// </summary>
    public string WikiMediaUserName { get; set; }
    /// <summary>
    /// Wikimedia password for public images upload
    /// </summary>
    public string WikiMediaPassword { get; set; }
    /// <summary>
    /// Fovea API Key for server side receipt validation
    /// </summary>
    public string FoveaApiKey { get; set; }
    /// <summary>
    /// RevenueCat API key for server side validation for IHM
    /// </summary>
    public string RevenueCatApiKeyIHM { get; set; }
    /// <summary>
    /// RevenueCat API key for server side validation for Mapeak
    /// </summary>
    public string RevenueCatApiKey { get; set; }
}