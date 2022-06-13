using Microsoft.Extensions.FileProviders;

namespace IsraelHiking.API.Services
{
    /// <summary>
    /// Helps returning or rendering with custom content the home page.
    /// </summary>
    public interface IHomePageHelper
    {
        /// <summary>
        /// Returns the home page FileInfo
        /// </summary>
        public IFileInfo IndexFileInfo { get; }
        
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
}