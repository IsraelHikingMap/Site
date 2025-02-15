using System.IO;
using System.Linq;
using System.Xml.Linq;
using IsraelHiking.DataAccessInterfaces;

namespace IsraelHiking.API.Converters.ConverterFlows;

///<inheritdoc />
public class GpxVersion1ToGpxVersion11ConverterFlow : IConverterFlowItem
{
    private readonly IGpsBabelGateway _gpsBabelGateway;
    ///<inheritdoc />
    public string Input => FlowFormats.GPX_BABEL_FORMAT_VERSION_1;
    ///<inheritdoc />
    public string Output => FlowFormats.GPX_BABEL_FORMAT;

    /// <summary>
    /// Constructor
    /// </summary>
    /// <param name="gpsBabelGateway"></param>
    public GpxVersion1ToGpxVersion11ConverterFlow(IGpsBabelGateway gpsBabelGateway)
    {
        _gpsBabelGateway = gpsBabelGateway;
    }

    ///<inheritdoc />
    public byte[] Transform(byte[] content)
    {
        if (!IsGpxVersion1(content))
        {
            return content;
        }
        return _gpsBabelGateway.ConvertFileFromat(content, Input, Output).Result;
    }

    /// <summary>
    /// Checks the header of the GPX file and returns if the file is GPX version 1.0
    /// </summary>
    /// <param name="content">The file content to test</param>
    /// <returns>True if this is a GPX version 1.0 content</returns>
    public static bool IsGpxVersion1(byte[] content)
    {
        if (content == null)
        {
            return false;
        }
        using var mempryStream = new MemoryStream(content);
        var document = XDocument.Load(mempryStream);
        return document.Elements().Where(x => x.Name.LocalName == "gpx").Attributes().Any(a => a.Name.LocalName == "version" && a.Value == "1.0");
    }
}