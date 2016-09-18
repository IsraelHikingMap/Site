using System.IO;
using System.Linq;
using System.Xml.Linq;
using IsraelHiking.DataAccessInterfaces;

namespace IsraelHiking.API.Converters.ConverterFlows
{
    public class GpxVersion1ToGpxVersion11ConverterFlow : IConverterFlowItem
    {
        private readonly IGpsBabelGateway _gpsBabelGateway;
        public string Input => FlowFormats.GPX_BABEL_FORMAT_VERSION_1;
        public string Output => FlowFormats.GPX_BABEL_FORMAT;

        public GpxVersion1ToGpxVersion11ConverterFlow(IGpsBabelGateway gpsBabelGateway)
        {
            _gpsBabelGateway = gpsBabelGateway;
        }

        public byte[] Transform(byte[] content)
        {
            if (!IsGpxVersion1(content))
            {
                return content;
            }
            return _gpsBabelGateway.ConvertFileFromat(content, Input, Output).Result;
        }

        public static bool IsGpxVersion1(byte[] content)
        {
            if (content == null)
            {
                return false;
            }
            using (var mempryStream = new MemoryStream(content))
            {
                var document = XDocument.Load(mempryStream);
                return document.Elements().Where(x => x.Name.LocalName == "gpx").Attributes().Any(a => a.Name.LocalName == "version" && a.Value == "1.0");
            }
        }
    }
}