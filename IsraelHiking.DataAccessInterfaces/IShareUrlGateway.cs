using System.Threading.Tasks;
using IsraelHiking.Common;

namespace IsraelHiking.DataAccessInterfaces;

public interface IShareUrlGateway
{
    Task<ShareUrl> GetUrlById(string id);
}