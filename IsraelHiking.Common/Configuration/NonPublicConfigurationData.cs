namespace IsraelHiking.Common.Configuration;

public class NonPublicConfigurationData
{
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
    /// <summary>
    /// Mapbox access token used to fetch the satellite imagery tiles that are served to subscribed users
    /// </summary>
    public string MapboxAccessToken { get; set; }
    /// <summary>
    /// The client id of the Garmin Connect Developer Program app, used to send routes to Garmin devices
    /// </summary>
    public string GarminClientId { get; set; }
    /// <summary>
    /// The client secret of the Garmin Connect Developer Program app - Garmin requires it to stay on the server
    /// </summary>
    public string GarminClientSecret { get; set; }
}