using IsraelHiking.API.Gpx;

namespace IsraelHiking.API.Converters.ConverterFlows;

/// <summary>
/// This class is responsible to convert from geojson to gpx
/// </summary>
public class GeoJsonGpxConverterFlow : IConverterFlowItem
{
    private readonly IGpxGeoJsonConverter _gpxGeoJsonConverter;
    ///<inheritdoc />
    public string Input => FlowFormats.GEOJSON;
    ///<inheritdoc />
    public string Output => FlowFormats.GPX_BABEL_FORMAT;

    /// <summary>
    /// Constructor
    /// </summary>
    /// <param name="gpxGeoJsonConverter"></param>
    public GeoJsonGpxConverterFlow(IGpxGeoJsonConverter gpxGeoJsonConverter)
    {
        _gpxGeoJsonConverter = gpxGeoJsonConverter;
    }

    ///<inheritdoc />
    public byte[] Transform(byte[] content)
    {
        return _gpxGeoJsonConverter.ToGpx(content.ToFeatureCollection()).ToBytes();
    }
}