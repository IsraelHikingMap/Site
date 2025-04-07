namespace IsraelHiking.Common.Api;

public class UpdateRequest
{
    /// <summary>
    /// Update all external sources with latest updates
    /// </summary>
    public bool AllExternalSources { get; set; }
    /// <summary>
    /// Updates images mirror
    /// </summary>
    public bool Images { get; set; }
    /// <summary>
    /// Update site map xml file and offline points of interest file
    /// </summary>
    public bool SiteMap { get; set; }
    /// <summary>
    /// Update pois file
    /// </summary>
    public bool OfflinePoisFile { get; set; }
}