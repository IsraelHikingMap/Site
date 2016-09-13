using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Threading.Tasks;
using System.Xml.Linq;
using Ionic.Zip;
using IsraelHiking.API.Converters;
using IsraelHiking.API.Gpx;
using IsraelHiking.API.Gpx.GpxTypes;
using IsraelHiking.Common;
using IsraelHiking.DataAccessInterfaces;

namespace IsraelHiking.API.Services
{
    public class ConverterFlowItem
    {
        public Func<byte[], byte[]> Transform { get; set; }
        public string Input { get; set; }
        public string Output { get; set; }
    }

    public class DataContainerConverterService : IDataContainerConverterService
    {
        private const string GEOJSON = "geojson";
        private const string GPX = "gpx";
        private const string KMZ = "kmz";
        private const string GPX_BABEL_FORMAT = "gpx,gpxver=1.1";
        private const string GPX_BABEL_FORMAT_VERSION_1 = "gpx,gpxver=1.0";
        private const string KML_BABEL_FORMAT = "kml,points=0";
        private const string TWL_BABEL_FORMAT = "naviguide";
        private const string CSV_BABEL_FORMAT = "csv";
        private const string GPX_SINGLE_TRACK = "gpx_single_track";
        private readonly IGpsBabelGateway _gpsBabelGateway;
        private readonly IGpxGeoJsonConverter _gpxGeoJsonConverter;
        private readonly IGpxDataContainerConverter _gpxDataContainerConverter;
        private readonly IDouglasPeuckerReductionService _douglasPeuckerReductionService;
        private readonly List<ConverterFlowItem> _converterFlowItems;

        public DataContainerConverterService(IGpsBabelGateway gpsBabelGateway,
            IGpxGeoJsonConverter gpxGeoJsonConverter,
            IGpxDataContainerConverter gpxDataContainerConverter,
            IDouglasPeuckerReductionService douglasPeuckerReductionService)
        {
            _gpsBabelGateway = gpsBabelGateway;
            _gpxGeoJsonConverter = gpxGeoJsonConverter;
            _gpxDataContainerConverter = gpxDataContainerConverter;
            _douglasPeuckerReductionService = douglasPeuckerReductionService;

            _converterFlowItems = new List<ConverterFlowItem>();
            _converterFlowItems.Add(new ConverterFlowItem
            {
                Input = GEOJSON,
                Output = GPX_BABEL_FORMAT,
                Transform = content => _gpxGeoJsonConverter.ToGpx(content.ToFeatureCollection()).ToBytes()
            });
            _converterFlowItems.Add(new ConverterFlowItem
            {
                Input = GPX_BABEL_FORMAT,
                Output = GEOJSON,
                Transform = content => _gpxGeoJsonConverter.ToGeoJson(content.ToGpx()).ToBytes()
            });
            _converterFlowItems.Add(new ConverterFlowItem
            {
                Input = GPX_BABEL_FORMAT,
                Output = GPX_SINGLE_TRACK,
                Transform = ConvertToSingleTrackGpx
            });
            _converterFlowItems.Add(new ConverterFlowItem
            {
                Input = KMZ,
                Output = KML_BABEL_FORMAT,
                Transform = ConvertKmzToKml
            });
            var supportedGpsBabelFormats = new List<string>
            {
                GPX_BABEL_FORMAT,
                GPX_BABEL_FORMAT_VERSION_1,
                KML_BABEL_FORMAT,
                TWL_BABEL_FORMAT,
                CSV_BABEL_FORMAT
            };
            foreach (var supportedGpsBabelInputFromat in supportedGpsBabelFormats)
            {
                foreach (var supportedGpsBabelOutputFormat in supportedGpsBabelFormats.Where(t => t != supportedGpsBabelInputFromat))
                {
                    _converterFlowItems.Add(new ConverterFlowItem
                    {
                        Input = supportedGpsBabelInputFromat,
                        Output = supportedGpsBabelOutputFormat,
                        Transform = content => _gpsBabelGateway.ConvertFileFromat(content, supportedGpsBabelInputFromat, supportedGpsBabelOutputFormat).Result
                    });
                }
            }
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
                container.routes = ManipulateRoutesData(container.routes, RoutingType.HIKE);
            }
            return container;
        }

        private Task<byte[]> Convert(byte[] content, string inputFileExtension, string outputFileExtension)
        {
            return Task.Run(() =>
            {
                var inputFormat = GetGpsBabelFormat(inputFileExtension, content);
                var outputFormat = GetGpsBabelFormat(outputFileExtension);
                if (inputFormat == outputFormat)
                {
                    return content;
                }
                var convertersList = GetConvertersList(inputFormat, outputFormat);
                if (!convertersList.Any())
                {
                    convertersList.Add(new ConverterFlowItem
                    {
                        Input = "any",
                        Output = "any",
                        Transform = anyContent => _gpsBabelGateway.ConvertFileFromat(anyContent, inputFormat, outputFormat).Result
                    });
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
        private List<ConverterFlowItem> GetConvertersList(string inputFormat, string outputFormat)
        {
            var inputConverters = _converterFlowItems.Where(c => c.Input == inputFormat).ToList();
            var outputConverters = _converterFlowItems.Where(c => c.Output == outputFormat).ToList();

            var singleConverter = inputConverters.Intersect(outputConverters).FirstOrDefault();
            if (singleConverter != null)
            {
                return new List<ConverterFlowItem> { singleConverter };
            }
            var firstConverter = inputConverters.FirstOrDefault(ci => outputConverters.Any(co => co.Input == ci.Output));
            if (firstConverter == null)
            {
                return new List<ConverterFlowItem>();
            }
            var lastConverter = outputConverters.FirstOrDefault(c => c.Input == firstConverter.Output && c.Output == outputFormat);
            return new List<ConverterFlowItem> { firstConverter, lastConverter };
        }

        private byte[] ConvertToSingleTrackGpx(byte[] content)
        {
            var gpx = content.ToGpx();
            var singleTrackGpx = new gpxType
            {
                wpt = gpx.wpt,
                rte = new rteType[0],
                trk = (gpx.trk ?? new trkType[0]).Select(t => new trkType
                {
                    name = t.name,
                    desc = t.desc,
                    cmt = t.cmt,
                    trkseg = new[] { new trksegType { trkpt = (t.trkseg ?? new trksegType[0]).SelectMany(s => s.trkpt).ToArray() } }
                }).ToArray()
            };
            return singleTrackGpx.ToBytes();
        }

        private byte[] ConvertKmzToKml(byte[] content)
        {
            using (var file = ZipFile.Read(new MemoryStream(content)))
            using (var memoryStreamKml = new MemoryStream())
            {
                var kmlEntry = file.Entries.FirstOrDefault(f => f.FileName.EndsWith(".kml"));
                if (kmlEntry == null)
                {
                    return new byte[0];
                }
                kmlEntry.Extract(memoryStreamKml);
                var bytes = memoryStreamKml.ToArray();
                return bytes;
            }
        }

        private string GetGpsBabelFormat(string extension, byte[] content = null)
        {
            extension = extension.ToLower().Replace(".", "");
            switch (extension)
            {
                case "twl":
                    return TWL_BABEL_FORMAT;
                case GPX:
                    return IsGpxVersion1(content) ? GPX_BABEL_FORMAT_VERSION_1 : GPX_BABEL_FORMAT;
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

        private bool IsGpxVersion1(byte[] content)
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
