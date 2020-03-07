using System.Threading.Tasks;

namespace IsraelHiking.DataAccessInterfaces
{
    public interface IReceiptValidationGateway
    {
        Task<bool> IsEntitled(string userId);
    }
}