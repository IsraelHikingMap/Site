using System.Threading.Tasks;
using IsraelHiking.Common.DataContainer;

namespace IsraelHiking.DataAccessInterfaces
{
    /// <summary>
    /// This service is responsible for creating images for data container
    /// </summary>
    public interface IImageCreationGateway
    {
        /// <summary>
        /// Creates an image from the data in <see cref="DataContainerPoco"/>
        /// </summary>
        /// <param name="dataContainer">The data to create the iamge from</param>
        /// <param name="width">Desired image width</param>
        /// <param name="height">Desired image height</param>
        /// <returns>Bitmap image represented as bytes</returns>
        Task<byte[]> Create(DataContainerPoco dataContainer, int width, int height);
    }
}