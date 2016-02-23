using System.Threading.Tasks;

namespace IsraelHiking.DataAccessInterfaces
{
    public interface IGpsBabelGateway
    {
        Task<byte[]> ConvertFileFromat(byte[] content, string inputFormat, string outputFormat);
    }
}
