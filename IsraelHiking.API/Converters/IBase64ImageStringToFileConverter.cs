using IsraelHiking.Common.Api;

namespace IsraelHiking.API.Converters;

/// <summary>
/// This converter takes a base 64 image string and converts is to byte and file name
/// </summary>
public interface IBase64ImageStringToFileConverter
{
    /// <summary>
    /// Converts an data image base 64 url to byte array and file extension
    /// </summary>
    /// <param name="url">The base 64 image data url</param>
    /// <param name="fileNameWithoutExtension">the file name with out an extension</param>
    /// <returns>null if this is not a vaild base 64 url, the file otherwise</returns>
    RemoteFileFetcherGatewayResponse ConvertToFile(string url, string fileNameWithoutExtension = "file");
}