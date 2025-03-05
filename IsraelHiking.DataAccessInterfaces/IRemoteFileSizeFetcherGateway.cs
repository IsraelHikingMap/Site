using System.Threading.Tasks;

namespace IsraelHiking.DataAccessInterfaces;

public interface IRemoteFileSizeFetcherGateway : IRemoteFileFetcherGateway
{
    Task<long> GetFileSize(string url);
}