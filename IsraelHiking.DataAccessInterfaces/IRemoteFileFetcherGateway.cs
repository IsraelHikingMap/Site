using IsraelHiking.Common.Api;
using System.IO;
using System.Threading.Tasks;

namespace IsraelHiking.DataAccessInterfaces;

public interface IRemoteFileFetcherGateway
{
    Task<RemoteFileFetcherGatewayResponse> GetFileContent(string url);

    /// <summary>
    /// Gets a read stream of a remote file's content without buffering it in memory, in order to proxy it to the client.
    /// </summary>
    /// <param name="url">The url of the file</param>
    /// <returns>A read stream of the file's content and its length when known</returns>
    Task<(Stream Content, long? Length)> GetFileStream(string url);

    /// <summary>
    /// Like <see cref="GetFileStream"/>, for a file that is made from what is posted to the given url, like an
    /// extract of a polygon that is too long to be a part of the url.
    /// </summary>
    /// <param name="url">The url of the file</param>
    /// <param name="content">The text posted to the url</param>
    /// <returns>A read stream of the file's content and its length when known</returns>
    Task<(Stream Content, long? Length)> PostForFileStream(string url, string content);
}