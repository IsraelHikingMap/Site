using System.Threading.Tasks;
using IsraelHiking.Common;

namespace IsraelHiking.API.Services
{
    public interface IDataContainerConverterService
    {
        Task<DataContainer> ToDataContainer(byte[] content, string format);
        Task<byte[]> ToAnyFormat(DataContainer dataContainer, string format);
    }
}