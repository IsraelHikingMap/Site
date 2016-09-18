using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using IsraelHiking.API.Gpx;

namespace IsraelHiking.API.Converters.ConverterFlows
{
    public class GeoJsonGpxConverterFlow : IConverterFlowItem
    {
        private readonly IGpxGeoJsonConverter _gpxGeoJsonConverter;
        public string Input => FlowFormats.GEOJSON;
        public string Output => FlowFormats.GPX_BABEL_FORMAT;

        public GeoJsonGpxConverterFlow(IGpxGeoJsonConverter gpxGeoJsonConverter)
        {
            _gpxGeoJsonConverter = gpxGeoJsonConverter;
        }

        public byte[] Transform(byte[] content)
        {
            return _gpxGeoJsonConverter.ToGpx(content.ToFeatureCollection()).ToBytes();
        }
    }
}
