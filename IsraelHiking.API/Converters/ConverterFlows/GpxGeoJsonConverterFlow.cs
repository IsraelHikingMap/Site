using IsraelHiking.API.Gpx;

namespace IsraelHiking.API.Converters.ConverterFlows
{
    public class GpxGeoJsonConverterFlow : IConverterFlowItem
    {
        private readonly IGpxGeoJsonConverter _gpxGeoJsonConverter;
        public string Input => FlowFormats.GPX_BABEL_FORMAT;
        public string Output => FlowFormats.GEOJSON;

        public GpxGeoJsonConverterFlow(IGpxGeoJsonConverter gpxGeoJsonConverter)
        {
            _gpxGeoJsonConverter = gpxGeoJsonConverter;
        }

        public byte[] Transform(byte[] content)
        {
            return _gpxGeoJsonConverter.ToGeoJson(content.ToGpx()).ToBytes();
        }
    }
}