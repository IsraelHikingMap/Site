using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Threading.Tasks;
using System.Xml.Linq;
using IsraelHiking.API.Converters;
using IsraelHiking.API.Gpx;
using IsraelHiking.API.Gpx.GpxTypes;
using IsraelHiking.Common;
using IsraelHiking.DataAccessInterfaces;

namespace IsraelHiking.API.Services
{
    public class DataContainerConverterService : IDataContainerConverterService
    {
        private const string GEOJSON = "geojson";
        private const string GPX = "gpx";
        private const string GPX_BABEL_FORMAT = "gpx,gpxver=1.1";
        private const string GPX_BABEL_FORMAT_VERSION_1 = "gpx,gpxver=1.0";
        private const string KML_BABEL_FORMAT = "kml,points=0";
        private const string GPX_SINGLE_TRACK = "gpx_single_track";
        private readonly IGpsBabelGateway _gpsBabelGateway;
        private readonly IGpxGeoJsonConverter _gpxGeoJsonConverter;
        private readonly IGpxDataContainerConverter _gpxDataContainerConverter;
        private readonly IDouglasPeuckerReductionService _douglasPeuckerReductionService;

        public DataContainerConverterService(IGpsBabelGateway gpsBabelGateway,
            IGpxGeoJsonConverter gpxGeoJsonConverter,
            IGpxDataContainerConverter gpxDataContainerConverter,
            IDouglasPeuckerReductionService douglasPeuckerReductionService)
        {
            _gpsBabelGateway = gpsBabelGateway;
            _gpxGeoJsonConverter = gpxGeoJsonConverter;
            _gpxDataContainerConverter = gpxDataContainerConverter;
            _douglasPeuckerReductionService = douglasPeuckerReductionService;
        }

        public Task<byte[]> ToAnyFormat(DataContainer dataContainer, string format)
        {
            var gpx = _gpxDataContainerConverter.ToGpx(dataContainer);
            return Convert(gpx.ToBytes(), GPX, format);
        }

        public async Task<DataContainer> ToDataContainer(byte[] content, string format)
        {
            var gpx = (await Convert(content, format, GPX)).ToGpx();
            var container = _gpxDataContainerConverter.ToDataContainer(gpx);
            if (gpx.creator != DataContainer.ISRAEL_HIKING_MAP)
            {
                // HM TODO: routing type is incomplete - make this better?
                container.routes = ManipulateRoutesData(container.routes, "h");
            }
            return container;
        }

        private async Task<byte[]> Convert(byte[] content, string inputFileExtension, string outputFileExtension)
        {
            var inputFormat = GetGpsBabelFormat(inputFileExtension, content);
            var outputFormat = GetGpsBabelFormat(outputFileExtension);
            if (inputFormat == outputFormat)
            {
                return content;
            }
            if (inputFormat == GEOJSON)
            {
                content = _gpxGeoJsonConverter.ToGpx(content.ToFeatureCollection()).ToBytes();
                inputFormat = GPX_BABEL_FORMAT;
            }
            if (inputFormat == outputFormat)
            {
                return content;
            }
            if (outputFormat != GEOJSON && outputFormat != GPX_SINGLE_TRACK)
            {
                return await _gpsBabelGateway.ConvertFileFromat(content, inputFormat, outputFormat);
            }
            var convertedGpx = await _gpsBabelGateway.ConvertFileFromat(content, inputFormat, GPX_BABEL_FORMAT);
            switch (outputFormat)
            {
                case GEOJSON:
                    return _gpxGeoJsonConverter.ToGeoJson(convertedGpx.ToGpx()).ToBytes();
                case GPX_SINGLE_TRACK:
                    return ConvertToSingleTrackGpx(convertedGpx);
                default:
                    throw new Exception("This is not a valid output format");
            }
        }

        private byte[] ConvertToSingleTrackGpx(byte[] content)
        {
            var gpx = content.ToGpx();
            var singleTrackGpx = new gpxType
            {
                wpt = gpx.wpt,
                rte = new rteType[0],
                trk = gpx.trk.Select(t => new trkType
                {
                    name = t.name,
                    desc = t.desc,
                    cmt = t.cmt,
                    trkseg = new[] {new trksegType {trkpt = t.trkseg.SelectMany(s => s.trkpt).ToArray()}}
                }).ToArray()
            };
            return singleTrackGpx.ToBytes();
        }

        private string GetGpsBabelFormat(string extension, byte[] content = null)
        {
            extension = extension.ToLower().Replace(".", "");
            switch (extension)
            {
                case "twl":
                    return "naviguide";
                case GPX:
                    return IsGetGpxVersion1(content) ? GPX_BABEL_FORMAT_VERSION_1 : GPX_BABEL_FORMAT;
                case "kml":
                    return KML_BABEL_FORMAT;
                default:
                    return extension;
            }
        }

        private List<RouteData> ManipulateRoutesData(IEnumerable<RouteData> routesData, string routingType)
        {
            return routesData.Select(r => _douglasPeuckerReductionService.SimplifyRouteData(r, routingType)).ToList();
        }

        private bool IsGetGpxVersion1(byte[] content)
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
