using System.IO;
using ICSharpCode.SharpZipLib.Zip;

namespace IsraelHiking.API.Converters.ConverterFlows
{///<inheritdoc />
    public class KmzToKmlConverterFlow : IConverterFlowItem
    {
        ///<inheritdoc />
        public string Input => FlowFormats.KMZ;
        ///<inheritdoc />
        public string Output => FlowFormats.KML_BABEL_FORMAT;

        ///<inheritdoc />
        public byte[] Transform(byte[] content)
        {
            using (var outputStream = new MemoryStream())
            using (var inputStream = new MemoryStream(content))
            {
                using (var zipInputStream = new ZipInputStream(inputStream))
                {
                    var entry = zipInputStream.GetNextEntry();
                    while (entry != null)
                    {
                        if (entry.IsFile && entry.Name.EndsWith(".kml"))
                        {
                            zipInputStream.CopyTo(outputStream);
                            return outputStream.ToArray();
                        }
                        entry = zipInputStream.GetNextEntry();
                    }
                }
                return new byte[0];
            }

        }
    }
}