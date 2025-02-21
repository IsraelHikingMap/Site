namespace IsraelHiking.API.Services;

/// <summary>
/// Helps with returning or rendering custom content of the home page.
/// </summary>
public interface IHomePageHelper
{
    /// <summary>
    /// Renders the home page with specified data
    /// </summary>
    /// <param name="title"></param>
    /// <param name="description"></param>
    /// <param name="thumbnailUrl"></param>
    /// <param name="language"></param>
    /// <returns></returns>
    string Render(string title, string description, string thumbnailUrl, string language = "");
}