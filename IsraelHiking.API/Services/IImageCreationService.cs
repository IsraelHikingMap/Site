using System.Threading.Tasks;
using IsraelHiking.Common;

namespace IsraelHiking.API.Services
{
    public interface IImageCreationService
    {
        Task<byte[]> Create(DataContainer dataContainer);
    }
}