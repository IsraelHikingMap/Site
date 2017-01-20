using System.IO;
using System.IO.Compression;

namespace IsraelHiking.API.Converters.ConverterFlows
{
    ///<inheritdoc />
    public class GpxGzToGpxConverterFlow : IConverterFlowItem
    {
        ///<inheritdoc />
        public string Input => FlowFormats.GPX_GZ;
        ///<inheritdoc />
        public string Output => FlowFormats.GPX_BABEL_FORMAT_VERSION_1;

        ///<inheritdoc />
        public byte[] Transform(byte[] content)
        {
            using (var contentStream = new MemoryStream(content))
            using (var memoryStreamDecompressed = new MemoryStream())
            using (var decompressionStream = new GZipStream(contentStream, CompressionMode.Decompress))
            {
                decompressionStream.CopyTo(memoryStreamDecompressed);
                var bytes = memoryStreamDecompressed.ToArray();
                return bytes;
            }
        }
    }
}