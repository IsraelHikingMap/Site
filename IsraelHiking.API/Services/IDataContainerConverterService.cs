using IsraelHiking.Common.DataContainer;
using System.Threading.Tasks;

namespace IsraelHiking.API.Services
{
    /// <summary>
    /// Conversion service from and to <see cref="DataContainerPoco"/>
    /// </summary>
    public interface IDataContainerConverterService
    {
        /// <summary>
        /// Converts bytes to <see cref="DataContainerPoco"/>
        /// </summary>
        /// <param name="content">File content in bytes</param>
        /// <param name="fileName">File name</param>
        /// <returns>Converted <see cref="DataContainerPoco"/></returns>
        Task<DataContainerPoco> ToDataContainer(byte[] content, string fileName);
        /// <summary>
        /// Converts <see cref="DataContainerPoco"/> to any format
        /// </summary>
        /// <param name="dataContainer">The data container</param>
        /// <param name="format">The format to convert to like GPX, KML etc.</param>
        /// <returns>Converted file in the form of bytes</returns>
        Task<byte[]> ToAnyFormat(DataContainerPoco dataContainer, string format);
        /// <summary>
        /// Converts any format to any format
        /// </summary>
        /// <param name="content">The file content to convert</param>
        /// <param name="inputFileNameOrFormat">The input file format</param>
        /// <param name="outputFileExtension">The output file format</param>
        /// <returns>Converted data</returns>
        Task<byte[]> Convert(byte[] content, string inputFileNameOrFormat, string outputFileExtension);
        /// <summary>
        /// Checks if the given input is a valid format
        /// </summary>
        /// <param name="inputFileNameOrFormat">The input file format</param>
        /// <returns>Converted data</returns>
        bool IsValidFormat(string inputFileNameOrFormat);
    }
}