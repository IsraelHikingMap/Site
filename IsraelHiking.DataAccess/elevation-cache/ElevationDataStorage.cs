using ICSharpCode.SharpZipLib.Core;
using ICSharpCode.SharpZipLib.Zip;
using IsraelHiking.DataAccessInterfaces;
using Microsoft.Extensions.FileProviders;
using Microsoft.Extensions.Logging;
using NetTopologySuite.Geometries;
using NetTopologySuite.Triangulate.QuadEdge;
using System;
using System.Collections.Concurrent;
using System.IO;
using System.Linq;
using System.Threading.Tasks;
using System.Text.RegularExpressions;

namespace IsraelHiking.DataAccess
{
    public class ElevationDataStorage : IElevationDataStorage
    {
        private const string ELEVATION_CACHE = "elevation-cache";
        private static readonly Regex HGT_NAME = new Regex(@"(?<latHem>N|S)(?<lat>\d{2})(?<lonHem>W|E)(?<lon>\d{3})");
        private readonly ILogger _logger;
        private readonly IFileProvider _fileProvider;
        private readonly ConcurrentDictionary<Coordinate, short[,]> _elevationData;
        private readonly ConcurrentDictionary<Coordinate, Task> _initializationTaskPerLatLng;

        public ElevationDataStorage(ILogger logger, IFileProvider fileProvider)
        {
            _logger = logger;
            _fileProvider = fileProvider;
            _elevationData = new ConcurrentDictionary<Coordinate, short[,]>();
            _initializationTaskPerLatLng = new ConcurrentDictionary<Coordinate, Task>();
        }

        public Task Initialize()
        {
            if (_fileProvider.GetDirectoryContents(ELEVATION_CACHE).Any() == false)
            {
                _logger.LogError($"!!! The folder: {ELEVATION_CACHE} does not exists, please change the BinariesFolder key in the configuration file !!!");
                return Task.CompletedTask;
            }
            var hgtZipFiles = _fileProvider.GetDirectoryContents(ELEVATION_CACHE);
            _logger.LogInformation("Found " + hgtZipFiles.Count() + " files in: " + _fileProvider.GetFileInfo(ELEVATION_CACHE).PhysicalPath);
            foreach (var hgtZipFile in hgtZipFiles)
            {
                var match = HGT_NAME.Match(hgtZipFile.Name);
                var latHem = match.Groups["latHem"].Value == "N" ? 1 : -1;
                var bottomLeftLat = int.Parse(match.Groups["lat"].Value) * latHem;
                var lonHem = match.Groups["lonHem"].Value == "E" ? 1 : -1;
                var bottomLeftLng = int.Parse(match.Groups["lon"].Value) * lonHem;
                var key = new Coordinate(bottomLeftLng, bottomLeftLat);

                _initializationTaskPerLatLng[key] = Task.Run(() =>
                {
                    _logger.LogInformation("Reading file " + hgtZipFile.Name);
                    var byteArray = GetByteArrayFromZip(hgtZipFile);
                    int samples = (short) (Math.Sqrt(byteArray.Length/2.0) + 0.5);
                    var elevationArray = new short[samples, samples];
                    for (int byteIndex = 0; byteIndex < byteArray.Length; byteIndex += 2)
                    {
                        short currentElevation = BitConverter.ToInt16(new[] {byteArray[byteIndex + 1], byteArray[byteIndex]}, 0);
                        elevationArray[(byteIndex/2)/samples, (byteIndex/2)%samples] = currentElevation;
                    }
                    _elevationData[key] = elevationArray;
                    _logger.LogInformation("Finished reading file " + hgtZipFile.Name);
                });
            }

            return Task.WhenAll(_initializationTaskPerLatLng.Values);
        }

        /// <summary>
        /// Calculates the elevation of a point using a preloaded data, using intepolation of 3 points in a plane:
        /// 3
        /// |    p
        /// |  
        /// 1______2
        /// </summary>
        /// <param name="latLng">The point to calculate elevation for</param>
        /// <returns>A task with the elevation results</returns>
        public async Task<double> GetElevation(Coordinate latLng)
        {
            var key = new Coordinate((int) latLng.X, (int) latLng.Y);
            if (_initializationTaskPerLatLng.ContainsKey(key) == false)
            {
                return 0;
            }
            await _initializationTaskPerLatLng[key];
            if (_elevationData.ContainsKey(key) == false)
            {
                return 0;
            }
            var array = _elevationData[key];
            var lat = (array.GetLength(0) - 1) - (latLng.Y - key.Y) * array.GetLength(0);
            var lng = (latLng.X - key.X) * array.GetLength(1);

            if ((lat >= array.GetLength(0) - 1) || (lng >= array.GetLength(1) - 1))
            {
                return array[(int) lat, (int) lng];
            }
            var coordinate1 = new CoordinateZ((int)lng, (int)lat, array[(int)lat, (int)lng]);
            var coordinate2 = new CoordinateZ((int)lng + 1, (int)lat, array[(int)lat, (int)lng + 1]);
            var coordinate3 = new CoordinateZ((int)lng, (int)lat + 1, array[(int)lat + 1, (int)lng]);
            return Vertex.InterpolateZ(new Coordinate(lng, lat), coordinate1, coordinate2, coordinate3);
        }

        private byte[] GetByteArrayFromZip(IFileInfo hgtZipFileInfo)
        {
            using (var memoryStream = new MemoryStream())
            using (var hgtStream = hgtZipFileInfo.CreateReadStream())
            {
                var hgtZipFile = new ZipFile(hgtStream);
                foreach (ZipEntry zipEntry in hgtZipFile)
                {
                    if (zipEntry.Name.ToLowerInvariant().Contains("hgt") == false)
                    {
                        continue;
                    }
                    var zipStream = hgtZipFile.GetInputStream(zipEntry);
                    StreamUtils.Copy(zipStream, memoryStream, new byte[4096]);
                    return memoryStream.ToArray();
                }
            }
            throw new Exception("Unable to find hgt file in : " + hgtZipFileInfo.Name);
        }
    }
}
