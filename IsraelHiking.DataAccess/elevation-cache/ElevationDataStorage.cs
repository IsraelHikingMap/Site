using IsraelHiking.DataAccessInterfaces;
using System;
using System.Collections.Concurrent;
using System.IO;
using System.Threading.Tasks;
using GeoAPI.Geometries;
using ICSharpCode.SharpZipLib.Core;
using ICSharpCode.SharpZipLib.Zip;
using NetTopologySuite.Triangulate.QuadEdge;

namespace IsraelHiking.DataAccess
{
    public class ElevationDataStorage : IElevationDataStorage
    {
        private const string ELEVATION_CACHE = "elevation-cache";
        private readonly ILogger _logger;
        private readonly IConfigurationProvider _configurationProvider;
        private readonly IFileSystemHelper _fileSystemHelper;
        private readonly ConcurrentDictionary<Coordinate, short[,]> _elevationData;
        private readonly ConcurrentDictionary<Coordinate, Task> _initializationTaskPerLatLng;

        public ElevationDataStorage(ILogger logger, IConfigurationProvider configurationProvider, IFileSystemHelper fileSystemHelper)
        {
            _logger = logger;
            _configurationProvider = configurationProvider;
            _fileSystemHelper = fileSystemHelper;
            _elevationData = new ConcurrentDictionary<Coordinate, short[,]>();
            _initializationTaskPerLatLng = new ConcurrentDictionary<Coordinate, Task>();
        }

        public Task Initialize()
        {
            var elevationCacheFolder = Path.Combine(_configurationProvider.BinariesFolder, ELEVATION_CACHE);
            if (Directory.Exists(elevationCacheFolder) == false)
            {
                _logger.LogError($"!!! The folder: {elevationCacheFolder} does not exists, please change the BinariesFolder key in the configuration file !!!");
                return Task.Run(() => { });
            }
            var hgtZipFiles = Directory.GetFiles(elevationCacheFolder, "*.hgt.zip");
            _logger.LogDebug("Found " + hgtZipFiles.Length + " files in: " + elevationCacheFolder);
            foreach (var hgtZipFile in hgtZipFiles)
            {
                var bottomLeftLat = int.Parse(Path.GetFileName(hgtZipFile).Substring(1, 2));
                var bottomLeftLng = int.Parse(Path.GetFileName(hgtZipFile).Substring(4, 3));
                var key = new Coordinate(bottomLeftLng, bottomLeftLat);

                _initializationTaskPerLatLng[key] = Task.Run(() =>
                {
                    _logger.LogDebug("Reading file " + hgtZipFile);
                    var byteArray = GetByteArrayFromZip(hgtZipFile);
                    int samples = (short) (Math.Sqrt(byteArray.Length/2.0) + 0.5);
                    var elevationArray = new short[samples, samples];
                    for (int byteIndex = 0; byteIndex < byteArray.Length; byteIndex += 2)
                    {
                        short currentElevation = BitConverter.ToInt16(new[] {byteArray[byteIndex + 1], byteArray[byteIndex]}, 0);
                        elevationArray[(byteIndex/2)/samples, (byteIndex/2)%samples] = currentElevation;
                    }
                    _elevationData[key] = elevationArray;
                    _logger.LogDebug("Finished reading file " + hgtZipFile);
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
            var coordinate1 = new Coordinate((int)lng, (int)lat, array[(int)lat, (int)lng]);
            var coordinate2 = new Coordinate((int)lng + 1, (int)lat, array[(int)lat, (int)lng + 1]);
            var coordinate3 = new Coordinate((int)lng, (int)lat + 1, array[(int)lat + 1, (int)lng]);
            return Vertex.InterpolateZ(new Coordinate(lng, lat), coordinate1, coordinate2, coordinate3);
        }

        private byte[] GetByteArrayFromZip(string hgtZipFilePath)
        {
            using (var memoryStream = new MemoryStream())
            using (var hgtStream = _fileSystemHelper.FileOpenRead(hgtZipFilePath))
            {
                var hgtZipFile = new ZipFile(hgtStream);
                foreach (ZipEntry zipEntry in hgtZipFile)
                {
                    if (zipEntry.Name.Contains("hgt") == false)
                    {
                        continue;
                    }
                    var zipStream = hgtZipFile.GetInputStream(zipEntry);
                    StreamUtils.Copy(zipStream, memoryStream, new byte[4096]);
                    return memoryStream.ToArray();
                }
            }
            throw new Exception("Unable to find hgt file in : " + hgtZipFilePath);
        }
    }
}
