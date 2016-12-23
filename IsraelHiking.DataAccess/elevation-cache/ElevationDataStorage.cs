using Ionic.Zip;
using IsraelHiking.Common;
using IsraelHiking.DataAccessInterfaces;
using System;
using System.Collections.Concurrent;
using System.IO;
using System.Linq;
using System.Threading.Tasks;

namespace IsraelHiking.DataAccess
{
    public class ElevationDataStorage : IElevationDataStorage
    {
        private const string ELEVATION_CACHE = "elevation-cache";
        private readonly ILogger _logger;
        private readonly IConfigurationProvider _configurationProvider;
        private readonly ConcurrentDictionary<LatLng, short[,]> _elevationData;
        private readonly ConcurrentDictionary<LatLng, Task> _initializationTaskPerLatLng;

        public ElevationDataStorage(ILogger logger, IConfigurationProvider configurationProvider)
        {
            _logger = logger;
            _configurationProvider = configurationProvider;
            _elevationData = new ConcurrentDictionary<LatLng, short[,]>();
            _initializationTaskPerLatLng = new ConcurrentDictionary<LatLng, Task>();
        }

        public Task Initialize()
        {
            var elevationCacheFolder = Path.Combine(_configurationProvider.BinariesFolder, ELEVATION_CACHE);
            if (Directory.Exists(elevationCacheFolder) == false)
            {
                _logger.Error($"!!! The folder: {elevationCacheFolder} does not exists, please change the BinariesFolder key in the configuration file !!!");
                return Task.Run(() => { });
            }
            var hgtZipFiles = Directory.GetFiles(elevationCacheFolder, "*.hgt.zip");
            _logger.Debug("Found " + hgtZipFiles.Length + " files in: " + elevationCacheFolder);
            foreach (var hgtZipFile in hgtZipFiles)
            {
                var bottomLeftLat = int.Parse(Path.GetFileName(hgtZipFile).Substring(1, 2));
                var bottomLeftLng = int.Parse(Path.GetFileName(hgtZipFile).Substring(4, 3));
                var key = new LatLng { lat = bottomLeftLat, lng = bottomLeftLng };

                _initializationTaskPerLatLng[key] = Task.Run(() =>
                {
                    _logger.Debug("Reading file " + hgtZipFile);
                    var byteArray = GetByteArrayFromZip(hgtZipFile);
                    int samples = (short) (Math.Sqrt(byteArray.Length/2.0) + 0.5);
                    var elevationArray = new short[samples, samples];
                    for (int byteIndex = 0; byteIndex < byteArray.Length; byteIndex += 2)
                    {
                        short currentElevation = BitConverter.ToInt16(new[] {byteArray[byteIndex + 1], byteArray[byteIndex]}, 0);
                        elevationArray[(byteIndex/2)/samples, (byteIndex/2)%samples] = currentElevation;
                    }
                    _elevationData[key] = elevationArray;
                    _logger.Debug("Finished reading file " + hgtZipFile);
                });
            }

            return Task.WhenAll(_initializationTaskPerLatLng.Values);
        }

        public async Task<double> GetElevation(LatLng latLng)
        {
            var key = new LatLng { lat = (int)latLng.lat, lng = (int)latLng.lng };
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
            var samplesSize = 1.0 / array.GetLength(0);
            var latIndex = (array.GetLength(0) - 1) - (int)((latLng.lat - key.lat) / samplesSize);
            var lngIndex = (int)((latLng.lng - key.lng) / samplesSize);

            return array[latIndex, lngIndex];
        }

        private byte[] GetByteArrayFromZip(string hgtZipFile)
        {
            using (ZipFile zip = ZipFile.Read(hgtZipFile))
            {
                var entry = zip.Entries.First(e => e.FileName.Contains("hgt"));
                using (var ms = new MemoryStream())
                {
                    entry.Extract(ms);
                    return ms.ToArray();
                }
            }
        }
    }
}
