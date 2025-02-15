using IsraelHiking.API.Gpx;

namespace IsraelHiking.API.Converters.ConverterFlows;

///<inheritdoc />
public class GpxGeoJsonConverterFlow : IConverterFlowItem
{
    private readonly IGpxGeoJsonConverter _gpxGeoJsonConverter;
    ///<inheritdoc />
    public string Input => FlowFormats.GPX_BABEL_FORMAT;
    ///<inheritdoc />
    public string Output => FlowFormats.GEOJSON;

    /// <summary>
    /// Constructor
    /// </summary>
    /// <param name="gpxGeoJsonConverter"></param>
    public GpxGeoJsonConverterFlow(IGpxGeoJsonConverter gpxGeoJsonConverter)
    {
        _gpxGeoJsonConverter = gpxGeoJsonConverter;
    }

    ///<inheritdoc />
    public byte[] Transform(byte[] content)
    {
        return _gpxGeoJsonConverter.ToGeoJson(content.ToGpx()).ToBytes();
    }
}