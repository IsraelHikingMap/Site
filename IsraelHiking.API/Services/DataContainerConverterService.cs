using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using IsraelHiking.API.Converters;
using IsraelHiking.API.Converters.ConverterFlows;
using IsraelHiking.API.Gpx;
using IsraelHiking.Common;
using IsraelHiking.DataAccessInterfaces;
using System;

namespace IsraelHiking.API.Services
{
    ///<inheritdoc />
    public class DataContainerConverterService : IDataContainerConverterService
    {
        /// <summary>
        /// Gpx file extension constant string
        /// </summary>
        public const string GPX = "gpx";

        private const string ISRAEL_HIKING_MAP = "IsraelHikingMap";
        private readonly IGpsBabelGateway _gpsBabelGateway;
        private readonly IGpxDataContainerConverter _gpxDataContainerConverter;
        private readonly IRouteDataSplitterService _routeDataSplitterService;
        private readonly List<IConverterFlowItem> _converterFlowItems;

        /// <summary>
        /// Constructor
        /// </summary>
        /// <param name="gpsBabelGateway"></param>
        /// <param name="gpxDataContainerConverter"></param>
        /// <param name="routeDataSplitterService"></param>
        /// <param name="converterFlowItems"></param>
        public DataContainerConverterService(IGpsBabelGateway gpsBabelGateway,
            IGpxDataContainerConverter gpxDataContainerConverter,
            IRouteDataSplitterService routeDataSplitterService,
            IEnumerable<IConverterFlowItem> converterFlowItems)
        {
            _gpsBabelGateway = gpsBabelGateway;
            _gpxDataContainerConverter = gpxDataContainerConverter;
            _routeDataSplitterService = routeDataSplitterService;
            _converterFlowItems = new List<IConverterFlowItem>();
            _converterFlowItems.AddRange(converterFlowItems);

            var supportedGpsBabelFormats = new List<string>
            {
                FlowFormats.GPX_BABEL_FORMAT,
                FlowFormats.KML_BABEL_FORMAT,
                FlowFormats.TWL_BABEL_FORMAT,
                FlowFormats.CSV_BABEL_FORMAT
            };
            foreach (var supportedGpsBabelInputFromat in supportedGpsBabelFormats)
            {
                foreach (var supportedGpsBabelOutputFormat in supportedGpsBabelFormats.Where(t => t != supportedGpsBabelInputFromat))
                {
                    _converterFlowItems.Add(new GpsBabelConverterFlow(_gpsBabelGateway, supportedGpsBabelInputFromat, supportedGpsBabelOutputFormat));
                }
            }
        }

        ///<inheritdoc />
        public Task<byte[]> ToAnyFormat(DataContainer dataContainer, string format)
        {
            var gpx = _gpxDataContainerConverter.ToGpx(dataContainer);
            gpx.creator = ISRAEL_HIKING_MAP;
            return Convert(gpx.ToBytes(), GPX, format);
        }

        ///<inheritdoc />
        public async Task<DataContainer> ToDataContainer(byte[] content, string fileName)
        {
            var gpx = (await Convert(content, fileName, GPX)).ToGpx();
            var container = _gpxDataContainerConverter.ToDataContainer(gpx);
            if (gpx.creator == ISRAEL_HIKING_MAP)
            {
                return container;
            }
            foreach (var route in container.Routes.Where(r => r.Segments.SelectMany(s => s.Latlngs).Any()))
            {
                route.Segments = _routeDataSplitterService.Split(route, RoutingType.HIKE).Segments;
            }
            foreach (var route in container.Routes.Where(r => string.IsNullOrWhiteSpace(r.Name)))
            {
                route.Name = fileName;
            }
            return container;
        }

        ///<inheritdoc />
        public Task<byte[]> Convert(byte[] content, string inputFileNameOrFormat, string outputFileExtension)
        {
            return Task.Run(() =>
            {
                var inputFormat = GetGpsBabelFormat(inputFileNameOrFormat, content);
                var outputFormat = GetGpsBabelFormat(outputFileExtension);
                if (inputFormat == outputFormat)
                {
                    return content;
                }
                var convertersList = GetConvertersList(inputFormat, outputFormat);
                if (!convertersList.Any())
                {
                    convertersList.Add(new GpsBabelConverterFlow(_gpsBabelGateway, inputFormat, outputFormat));
                }
                return convertersList.Aggregate(content, (current, converter) => converter.Transform(current));
            });
        }

        /// <summary>
        /// This method created a list containig the converters needed in order to get from input to output.
        /// The algorithm used here is simple and assumes maximum 2 converters.
        /// </summary>
        /// <param name="inputFormat"></param>
        /// <param name="outputFormat"></param>
        /// <returns></returns>
        private List<IConverterFlowItem> GetConvertersList(string inputFormat, string outputFormat)
        {
            var inputConverters = _converterFlowItems.Where(c => c.Input == inputFormat).ToList();
            var outputConverters = _converterFlowItems.Where(c => c.Output == outputFormat).ToList();

            var singleConverter = inputConverters.Intersect(outputConverters).FirstOrDefault();
            if (singleConverter != null)
            {
                return new List<IConverterFlowItem> { singleConverter };
            }
            var firstConverter = inputConverters.FirstOrDefault(ci => outputConverters.Any(co => co.Input == ci.Output));
            if (firstConverter == null)
            {
                return new List<IConverterFlowItem>();
            }
            var lastConverter = outputConverters.FirstOrDefault(c => c.Input == firstConverter.Output && c.Output == outputFormat);
            return new List<IConverterFlowItem> { firstConverter, lastConverter };
        }

        private string GetGpsBabelFormat(string fileNameOrFormat, byte[] content = null)
        {
            fileNameOrFormat = fileNameOrFormat.ToLower();
            if (fileNameOrFormat.EndsWith("twl"))
            {
                return FlowFormats.TWL_BABEL_FORMAT;
            }
            if (fileNameOrFormat.EndsWith(GPX))
            {
                return GpxVersion1ToGpxVersion11ConverterFlow.IsGpxVersion1(content) 
                    ? FlowFormats.GPX_BABEL_FORMAT_VERSION_1 
                    : FlowFormats.GPX_BABEL_FORMAT;
            }
            if (fileNameOrFormat.EndsWith("gpx.gz"))
            {
                return FlowFormats.GPX_GZ;
            }
            if (fileNameOrFormat.EndsWith("gpx.bz2"))
            {
                return FlowFormats.GPX_BZ2;
            }
            if (fileNameOrFormat.EndsWith("kml"))
            {
                return FlowFormats.KML_BABEL_FORMAT;
            }
            if (fileNameOrFormat.EndsWith("kmz"))
            {
                return FlowFormats.KMZ;
            }
            if (fileNameOrFormat.EndsWith("csv"))
            {
                return FlowFormats.CSV_BABEL_FORMAT;
            }
            if (fileNameOrFormat.EndsWith("geojson"))
            {
                return FlowFormats.GEOJSON;
            }
            if (fileNameOrFormat.EndsWith("plt"))
            {
                return FlowFormats.OZI_BABEL_FORMAT;
            }
            if (fileNameOrFormat.EndsWith("rte"))
            {
                return FlowFormats.COMPEGPS_BABEL_FORMAT;
            }
            if (fileNameOrFormat.EndsWith("trk"))
            {
                return FlowFormats.COMPEGPS_BABEL_FORMAT;
            }
            if (fileNameOrFormat.EndsWith("jpg") || fileNameOrFormat.EndsWith("jpeg"))
            {
                return FlowFormats.JPG_BABEL_FORMAT;
            }
            if (fileNameOrFormat == FlowFormats.GPX_SINGLE_TRACK)
            {
                return fileNameOrFormat;
            }
            if (fileNameOrFormat == FlowFormats.GPX_ROUTE)
            {
                return fileNameOrFormat;
            }
            throw new Exception("Unsupported file format: " + fileNameOrFormat);
        }
    }
}
