using System.Threading.Tasks;
using IsraelHiking.Common;

namespace IsraelHiking.API.Services
{
    /// <summary>
    /// This service is responsible for creating images for data container
    /// </summary>
    public interface IImageCreationService
    {
        /// <summary>
        /// Creates an image from the data in <see cref="DataContainer"/>
        /// </summary>
        /// <param name="dataContainer">The data to create the iamge from</param>
        /// <returns>Bitmap image represented as bytes</returns>
        Task<byte[]> Create(DataContainer dataContainer);
    }
}