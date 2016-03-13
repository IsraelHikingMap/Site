using System.Threading.Tasks;
using IsraelHiking.Common;

namespace IsraelHiking.API.Gpx
{
    public interface IDataContainerConverter
    {
        Task<DataContainer> ToDataContainer(byte[] content, string format);
        Task<byte[]> ToAnyFormat(DataContainer dataContainer, string format);
    }
}