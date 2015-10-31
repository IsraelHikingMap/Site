using System.Threading.Tasks;

namespace IsraelHiking.DataAccessInterfaces
{
    public interface IRemoveFileFetcherGateway
    {
        Task<byte[]> GetFileContent(string url);
    }
}