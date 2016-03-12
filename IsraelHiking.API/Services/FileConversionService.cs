using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using IsraelHiking.API.Gpx;
using IsraelHiking.API.Gpx.GpxTypes;
using IsraelHiking.Common;
using IsraelHiking.DataAccessInterfaces;
using IsraelTransverseMercator;

namespace IsraelHiking.API.Services
{
    public class FileConversionService : IFileConversionService
    {
        private const int MAX_SEGMENTS_NUMBER = 20;
        private const int MINIMAL_SEGMENT_LENGTH = 500; // meters
        private const string GEOJSON = "geojson";
        private const string GPX_BABEL_FORMAT = "gpx,gpxver=1.1";
        private const string GPX_SINGLE_TRACK = "gpx_single_track";
        private readonly IGpsBabelGateway _gpsBabelGateway;
        private readonly IGpxGeoJsonConverter _gpxGeoJsonConverter;
        private readonly IGpxDataContainerConverter _gpxDataContainerConverter;
        private readonly ICoordinatesConverter _coordinatesConverter;

        public FileConversionService(IGpsBabelGateway gpsBabelGateway,
            IGpxGeoJsonConverter gpxGeoJsonConverter,
            IGpxDataContainerConverter gpxDataContainerConverter,
            ICoordinatesConverter coordinatesConverter)
        {
            _gpsBabelGateway = gpsBabelGateway;
            _gpxGeoJsonConverter = gpxGeoJsonConverter;
            _gpxDataContainerConverter = gpxDataContainerConverter;
            _coordinatesConverter = coordinatesConverter;
        }

        public async Task<byte[]> Convert(byte[] content, string inputFileExtension, string outputFileExtension)
        {
            var inputFormat = ConvertExtenstionToFormat(inputFileExtension);
            var outputFormat = ConvertExtenstionToFormat(outputFileExtension);
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

        public async Task<DataContainer> ConvertAnyFormatToDataContainer(byte[] content, string extension)
        {
            var gpxBytes = await Convert(content, extension, ".gpx");
            var gpx = gpxBytes.ToGpx();
            var container = _gpxDataContainerConverter.ToDataContainer(gpx);
            if (gpx.creator != DataContainer.ISRAEL_HIKING_MAP)
            {
                // HM TODO: routing type is incomplete - make this better?
                container.routes = ManipulateRoutesData(container.routes, "h");
            }
            return container;
        }

        private string ConvertExtenstionToFormat(string extension)
        {
            extension = extension.ToLower().Replace(".", "");
            switch (extension)
            {
                case "twl":
                    return "naviguide";
                case "gpx":
                    return GPX_BABEL_FORMAT;
                default:
                    return extension;
            }
        }

        private List<RouteData> ManipulateRoutesData(IEnumerable<RouteData> routesData, string routingType)
        {
            var returnArray = new List<RouteData>();
            foreach (var routeData in routesData)
            {
                var allRoutePoints = routeData.segments.SelectMany(s => s.latlngzs).ToList();
                var manipulatedRouteData = new RouteData
                {
                    segments = new List<RouteSegmentData> { new RouteSegmentData
                    {
                        routePoint = allRoutePoints.First(),
                        latlngzs = new List<LatLngZ> { allRoutePoints.First(), allRoutePoints.First() }
                    } },
                    name = routeData.name
                };
                var routeLength = allRoutePoints.Skip(1).Select((p, i) => GetDistance(p, allRoutePoints[i])).Sum();
                var segmentLength = routeLength / MAX_SEGMENTS_NUMBER;
                if (segmentLength < MINIMAL_SEGMENT_LENGTH)
                {
                    segmentLength = MINIMAL_SEGMENT_LENGTH;
                }

                var currentSegmentLength = 0.0;
                var segmentData = new RouteSegmentData
                {
                    latlngzs = new List<LatLngZ> { allRoutePoints[0] },
                    routePoint = allRoutePoints[0],
                    routingType = routingType
                };

                for (var latlngIndex = 1; latlngIndex < allRoutePoints.Count; latlngIndex++)
                {      
                    currentSegmentLength += GetDistance(allRoutePoints[latlngIndex - 1], allRoutePoints[latlngIndex]);
                    if (currentSegmentLength < segmentLength)
                    {
                        segmentData.latlngzs.Add(allRoutePoints[latlngIndex]);
                        segmentData.routePoint = allRoutePoints[latlngIndex];
                        continue;
                    }
                    
                    manipulatedRouteData.segments.Add(segmentData);
                    currentSegmentLength = 0;
                    segmentData = new RouteSegmentData
                    {
                        latlngzs = new List<LatLngZ> { allRoutePoints[latlngIndex - 1], allRoutePoints[latlngIndex] },
                        routePoint = allRoutePoints[latlngIndex],
                        routingType = routingType
                    };
                }
                manipulatedRouteData.segments.Add(segmentData);
                returnArray.Add(manipulatedRouteData);
            }

            return returnArray;
        }

        private double GetDistance(LatLng point1, LatLng point2)
        {
            var northEast1 = _coordinatesConverter.Wgs84ToItm(new LatLon { Latitude = point1.lat, Longitude = point1.lng });
            var northEast2 = _coordinatesConverter.Wgs84ToItm(new LatLon { Latitude = point2.lat, Longitude = point2.lng });
            return Math.Sqrt(Math.Pow(northEast1.North - northEast2.North, 2) + Math.Pow(northEast1.East - northEast2.East, 2));
        }
    }
}
