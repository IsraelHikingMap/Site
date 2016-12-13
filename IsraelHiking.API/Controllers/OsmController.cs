using System.Collections.Generic;
using System.Collections.ObjectModel;
using System.Linq;
using System.Net.Http;
using System.Threading.Tasks;
using System.Web.Http;
using GeoAPI.Geometries;
using IsraelHiking.API.Gpx;
using IsraelHiking.API.Gpx.GpxTypes;
using IsraelHiking.API.Services;
using IsraelHiking.Common;
using IsraelHiking.DataAccessInterfaces;
using IsraelTransverseMercator;
using NetTopologySuite.Features;
using NetTopologySuite.Geometries;
using NetTopologySuite.Simplify;

namespace IsraelHiking.API.Controllers
{
    public class OsmController : ApiController
    {
        private const double SIMPLIFICATION_TOLERANCE = 5; // meters
        private const double MINIMAL_MISSING_PART_LENGTH = 200; // meters
        private const double CLOSEST_POINT_TOLERANCE = 30; // meters
        private const double MINIMAL_MISSING_SELF_LOOP_PART_LENGTH = CLOSEST_POINT_TOLERANCE; // meters
        private const int MAX_NUMBER_OF_POINTS_PER_LINE = 1000;
        

        private readonly IHttpGatewayFactory _httpGatewayFactory;
        private readonly IDataContainerConverterService _dataContainerConverterService;
        private readonly ICoordinatesConverter _coordinatesConverter;
        private readonly IGpxSplitterService _gpxSplitterService;
        private readonly IElasticSearchGateway _elasticSearchGateway;
        private readonly LruCache<string, TokenAndSecret> _cache;

        public OsmController(IHttpGatewayFactory httpGatewayFactory,
            IDataContainerConverterService dataContainerConverterService,
            ICoordinatesConverter coordinatesConverter,
            IGpxSplitterService gpxSplitterService,
            IElasticSearchGateway elasticSearchGateway,
            LruCache<string, TokenAndSecret> cache)
        {
            _httpGatewayFactory = httpGatewayFactory;
            _dataContainerConverterService = dataContainerConverterService;
            _coordinatesConverter = coordinatesConverter;
            _gpxSplitterService = gpxSplitterService;
            _cache = cache;
            _elasticSearchGateway = elasticSearchGateway;
        }

        public async Task<List<Feature>> GetHighways(string northEast, string southWest)
        {
            return await _elasticSearchGateway.GetHighways(new LatLng(northEast), new LatLng(southWest));
        }

        [Authorize]
        public async Task<FeatureCollection> PostGpsTrace(string url)
        {
            var response = await GetFile(url);
            var gpxBytes = await _dataContainerConverterService.Convert(response.Content, response.FileName, DataContainerConverterService.GPX);
            var gpx = gpxBytes.ToGpx().UpdateBounds();
            var routingType = GetRoutingType(gpx);
            var gpxLines = GpxToLineStrings(gpx);
            var manipulatedLines = await ManipulateGpxIntoAddibleLines(gpxLines);
            var attributesTable = new AttributesTable();
            attributesTable.AddAttribute("routingType", routingType);
            var features = manipulatedLines.Select(l => new Feature(ToWgs84LineString(l.Coordinates), attributesTable) as IFeature).ToList();
            return new FeatureCollection(new Collection<IFeature>(features));
        }

        private async Task<RemoteFileFetcherGatewayResponse> GetFile(string url)
        {
            if (string.IsNullOrEmpty(url) == false)
            {
                var fetcher = _httpGatewayFactory.CreateRemoteFileFetcherGateway(_cache.Get(User.Identity.Name));
                return await fetcher.GetFileContent(url);
            }
            var streamProvider = new MultipartMemoryStreamProvider();
            var multipartFileStreamProvider = await Request.Content.ReadAsMultipartAsync(streamProvider);

            if (multipartFileStreamProvider.Contents.Count == 0)
            {
                return new RemoteFileFetcherGatewayResponse();
            }
            return new RemoteFileFetcherGatewayResponse
            {
                Content = await streamProvider.Contents.First().ReadAsByteArrayAsync(),
                FileName = streamProvider.Contents.First().Headers.ContentDisposition.FileName.Trim('"')
            };
        }


        private List<LineString> SimplifyLines(IEnumerable<LineString> lineStings)
        {
            var lines = new List<LineString>();
            foreach (var lineSting in lineStings)
            {
                var simpleLine = DouglasPeuckerSimplifier.Simplify(lineSting, SIMPLIFICATION_TOLERANCE) as LineString;
                if (simpleLine == null)
                {
                    continue;
                }
                simpleLine = RadialDistanceByAngleSimplifier.Simplify(simpleLine, MINIMAL_MISSING_SELF_LOOP_PART_LENGTH, 90);
                if (simpleLine == null)
                {
                    continue;
                }
                lines.Add(simpleLine);
            }
            return lines;
        }

        private string GetRoutingType(IReadOnlyCollection<wptType[]> waypointsGoups)
        {
            var velocityList = new List<double>();
            if (waypointsGoups.Count == 0)
            {
                return RoutingType.HIKE;
            }
            foreach (var waypoints in waypointsGoups)
            {
                if (waypoints.Last().timeSpecified == false || waypoints.First().timeSpecified == false)
                {
                    velocityList.Add(0);
                    continue;
                }
                var lengthInKm = ToItmLineString(waypoints).Length / 1000;
                var timeInHours = (waypoints.Last().time - waypoints.First().time).TotalHours;
                velocityList.Add(lengthInKm / timeInHours);
            }
            var averageVelocity = velocityList.Sum() / velocityList.Count;
            if (averageVelocity <= 6)
            {
                return RoutingType.HIKE;
            }
            if (averageVelocity <= 12)
            {
                return RoutingType.BIKE;
            }
            return RoutingType.FOUR_WHEEL_DRIVE;
        }

        private LineString ToItmLineString(IEnumerable<wptType> waypoints)
        {
            var coordinates = waypoints.Select(wptType =>
            {
                var northEast = _coordinatesConverter.Wgs84ToItm(new LatLon { Longitude = (double)wptType.lon, Latitude = (double)wptType.lat });
                return new Coordinate(northEast.East, northEast.North);
            }).ToArray();
            return new LineString(coordinates);
        }

        private LineString ToItmLineString(IEnumerable<Coordinate> coordinates)
        {
            var itmCoordinates = coordinates.Select(coordinate =>
            {
                var northEast = _coordinatesConverter.Wgs84ToItm(new LatLon { Longitude = coordinate.X, Latitude = coordinate.Y });
                return new Coordinate(northEast.East, northEast.North);
            }).ToArray();
            return new LineString(itmCoordinates);
        }

        private LineString ToWgs84LineString(IEnumerable<Coordinate> coordinates)
        {
            var cwgs84Coordinates = coordinates.Select(coordinate =>
            {
                var latLng = _coordinatesConverter.ItmToWgs84(new NorthEast { North = (int)coordinate.Y, East = (int)coordinate.X });
                return new Coordinate(latLng.Longitude, latLng.Latitude);
            }).ToArray();
            return new LineString(cwgs84Coordinates);
        }

        private string GetRoutingType(gpxType gpx)
        {
            var waypointsGroups = new List<wptType[]>();
            waypointsGroups.AddRange((gpx.rte ?? new rteType[0]).Select(route => route.rtept).Where(ps => ps.All(p => p.timeSpecified)).ToArray());
            waypointsGroups.AddRange((gpx.trk ?? new trkType[0]).Select(track => track.trkseg.SelectMany(s => s.trkpt).ToArray()).Where(ps => ps.All(p => p.timeSpecified)));
            return GetRoutingType(waypointsGroups);
        }

        private async Task<IEnumerable<LineString>> ManipulateGpxIntoAddibleLines(List<LineString> gpxLines)
        {
            var missingLines = await FindMissingLines(gpxLines);
            var missingLinesWithoutLoops = new List<LineString>();
            foreach (var missingLine in missingLines)
            {
                missingLinesWithoutLoops.AddRange(_gpxSplitterService.SplitSelfLoops(missingLine, CLOSEST_POINT_TOLERANCE));
            }
            missingLinesWithoutLoops.Reverse();
            var missingLinesWithoutLoopsAndDuplications = new List<LineString>();
            for (int index = 0; index < missingLinesWithoutLoops.Count; index++)
            {
                var missingLineWithoutLoops = missingLinesWithoutLoops[index];
                missingLinesWithoutLoopsAndDuplications.AddRange(_gpxSplitterService.GetMissingLines(missingLineWithoutLoops, missingLinesWithoutLoops.Take(index).ToArray(), MINIMAL_MISSING_SELF_LOOP_PART_LENGTH, CLOSEST_POINT_TOLERANCE));
            }
            missingLinesWithoutLoopsAndDuplications.Reverse();
            missingLinesWithoutLoopsAndDuplications = SimplifyLines(missingLinesWithoutLoopsAndDuplications);

            return await MergeSimplifiedLines(missingLinesWithoutLoopsAndDuplications);
        }

        private async Task<List<LineString>> FindMissingLines(List<LineString> gpxLines)
        {
            var missingLines = new List<LineString>();
            SplitLinesByNumberOfPoints(gpxLines);
            foreach (var gpxLine in gpxLines)
            {
                var lineStringsInArea = await GetLineStringsInArea(gpxLine);
                missingLines.AddRange(_gpxSplitterService.GetMissingLines(gpxLine, lineStringsInArea, MINIMAL_MISSING_PART_LENGTH, CLOSEST_POINT_TOLERANCE));
            }
            MergeBackLines(missingLines);
            return missingLines;
        }

        private async Task<List<LineString>> GetLineStringsInArea(LineString gpxLine)
        {
            var northEast = _coordinatesConverter.ItmToWgs84(new NorthEast
            {
                North = (int) gpxLine.Coordinates.Max(c => c.Y),
                East = (int) gpxLine.Coordinates.Max(c => c.X)
            });
            var southWest = _coordinatesConverter.ItmToWgs84(new NorthEast
            {
                North = (int) gpxLine.Coordinates.Min(c => c.Y),
                East = (int) gpxLine.Coordinates.Min(c => c.X)
            });
            var highways = await _elasticSearchGateway.GetHighways(new LatLng {lat = northEast.Latitude, lng = northEast.Longitude}, new LatLng {lat = southWest.Latitude, lng = southWest.Longitude});
            return highways.Select(highway => ToItmLineString(highway.Geometry.Coordinates)).ToList();
        }

        private List<LineString> GpxToLineStrings(gpxType gpx)
        {
            var lineStings = (gpx.rte ?? new rteType[0])
                .Select(route => ToItmLineString(route.rtept)).ToList();
            var tracksPointsList = (gpx.trk ?? new trkType[0])
                .Select(track => track.trkseg.SelectMany(s => s.trkpt).ToArray())
                .Select(ToItmLineString);
            lineStings.AddRange(tracksPointsList);
            return lineStings;
        }

        private void MergeBackLines(List<LineString> missingLines)
        {
            for (int lineIndex = missingLines.Count - 1; lineIndex >= 1; lineIndex--)
            {
                var currentLineCoordinates = missingLines[lineIndex].Coordinates.ToList();
                var previousLineCoordinates = missingLines[lineIndex - 1].Coordinates;
                if (!currentLineCoordinates.First().Equals2D(previousLineCoordinates.Last()))
                {
                    continue;
                }
                currentLineCoordinates.RemoveAt(0);
                missingLines[lineIndex - 1] = new LineString(previousLineCoordinates.Concat(currentLineCoordinates).ToArray());
                missingLines.RemoveAt(lineIndex);
            }
        }

        private void SplitLinesByNumberOfPoints(List<LineString> lineStings)
        {
            bool needToLinesToSplit;
            do
            {
                needToLinesToSplit = false;
                for (int lineIndex = 0; lineIndex < lineStings.Count; lineIndex++)
                {
                    var line = lineStings[lineIndex];
                    if (line.Count <= MAX_NUMBER_OF_POINTS_PER_LINE)
                    {
                        continue;
                    }
                    needToLinesToSplit = true;
                    var newLine = new LineString(line.Coordinates.Skip(line.Count / 2).ToArray());
                    if (lineIndex == lineStings.Count - 1)
                    {
                        lineStings.Add(newLine);
                    }
                    else
                    {
                        lineStings.Insert(lineIndex + 1, newLine);
                    }
                    lineStings[lineIndex] = new LineString(line.Coordinates.Take(line.Count / 2 + 1).ToArray());
                }
            } while (needToLinesToSplit);
        }

        private async Task<List<LineString>> MergeSimplifiedLines(List<LineString> simplifiedLines)
        {
            var mergedSimplifiedLines = new List<LineString>();
            // HM TODO: this is a naive implementation, it should be made better - not all lines are merged.
            for (int lineIndex = 1; lineIndex < simplifiedLines.Count; lineIndex++)
            {
                var currentLine = simplifiedLines[lineIndex];
                var previousLine = simplifiedLines[lineIndex - 1];
                var newLine = new LineString(new[] { previousLine.Coordinates.Last(), currentLine.Coordinates.First() });
                if (newLine.Length >= CLOSEST_POINT_TOLERANCE*2)
                {
                    mergedSimplifiedLines.Add(previousLine);
                    continue;
                }
                var linesInArea = await GetLineStringsInArea(newLine);
                if (linesInArea.Concat(simplifiedLines).Except(new [] { currentLine, previousLine }).Any(l => l.Intersects(newLine)))
                {
                    mergedSimplifiedLines.Add(previousLine);
                    continue;
                }
                simplifiedLines[lineIndex] = new LineString(previousLine.Coordinates.Concat(currentLine.Coordinates).ToArray());
            }
            mergedSimplifiedLines.Add(simplifiedLines.Last());
            return mergedSimplifiedLines;
        }
    }
}
