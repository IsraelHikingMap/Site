using System.IO;
using System.Linq;
using Ionic.Zip;

namespace IsraelHiking.API.Converters.ConverterFlows
{
    public class KmzToKmlConverterFlow : IConverterFlowItem
    {
        public string Input => FlowFormats.KMZ;
        public string Output => FlowFormats.KML_BABEL_FORMAT;

        public byte[] Transform(byte[] content)
        {
            using (var contentStream = new MemoryStream(content))
            using (var file = ZipFile.Read(contentStream))
            using (var memoryStreamDecompressed = new MemoryStream())
            {
                var fileEntry = file.Entries.FirstOrDefault(f => f.FileName.EndsWith(".kml"));
                if (fileEntry == null)
                {
                    return new byte[0];
                }
                fileEntry.Extract(memoryStreamDecompressed);
                var bytes = memoryStreamDecompressed.ToArray();
                return bytes;
            }
        }
    }
}