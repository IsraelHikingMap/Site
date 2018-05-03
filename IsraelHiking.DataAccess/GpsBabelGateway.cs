using System.Threading.Tasks;
using IsraelHiking.DataAccessInterfaces;
using IsraelHiking.GPSBabel;
using Microsoft.Extensions.Logging;

namespace IsraelHiking.DataAccess
{
    public class GpsBabelGateway : IGpsBabelGateway
    {
        private readonly ILogger _logger;
        private readonly IGPSBabelConverter _gpsBabelConverter;

        public GpsBabelGateway(ILogger logger)
        {
            _logger = logger;
            _gpsBabelConverter = new GPSBabelConverter();
        }

        public Task<byte[]> ConvertFileFromat(byte[] content, string inputFormat, string outputFormat)
        {
            return Task.Run(() =>
            {
                if (inputFormat == outputFormat)
                {
                    return content;
                }
                var outputContent = _gpsBabelConverter.Run(content, inputFormat, outputFormat, string.Empty);
                if (outputContent.Length > 0)
                {
                    _logger.LogInformation("Finished converting data from: " + inputFormat + " to: " + outputFormat);
                }
                else
                {
                    _logger.LogError("Failed converting data from: " + inputFormat + " to: " + outputFormat);
                }
                return outputContent;
            });
        }
    }
}
