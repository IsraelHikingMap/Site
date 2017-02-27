using System.IO;
using ICSharpCode.SharpZipLib.BZip2;

namespace IsraelHiking.API.Converters.ConverterFlows
{
    class GpxBz2ToGpxConverterFlow : IConverterFlowItem
    {
        public string Input => FlowFormats.GPX_BZ2;
        public string Output => FlowFormats.GPX_BABEL_FORMAT_VERSION_1;

        public byte[] Transform(byte[] content)
        {
            using (var contentStream = new MemoryStream(content))
            using (var bzipStream = new BZip2InputStream(contentStream))
            using (var memoryStreamDecompressed = new MemoryStream())
            {
                bzipStream.CopyTo(memoryStreamDecompressed);
                var bytes = memoryStreamDecompressed.ToArray();
                return bytes;
            }
        }
    }
}
