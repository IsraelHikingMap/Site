using Ionic.Zip;
using IsraelHiking.Common;
using IsraelHiking.DataAccessInterfaces;
using System;
using System.Collections.Generic;
using System.Configuration;
using System.IO;
using System.Linq;
using System.Threading.Tasks;

namespace IsraelHiking.DataAccess
{
    public class ElevationDataStorage : IElevationDataStorage
    {
        private readonly Dictionary<LatLng, short[,]> _elevationData;
        private readonly ILogger _logger;

        public ElevationDataStorage(ILogger logger)
        {
            _logger = logger;
            _elevationData = new Dictionary<LatLng, short[,]>();
        }

        public Task Initialize()
        {
            return Task.Run(() =>
            {
                var hgtFolder = ConfigurationManager.AppSettings["hgtFolder"].ToString();
                if (Directory.Exists(hgtFolder) == false)
                {
                    _logger.Error("!!! The folder: " + hgtFolder + " does not exists, please change the hgtFolder key in the configuration file !!!");
                    return;
                }
                var hgtZipFiles = Directory.GetFiles(hgtFolder, "*.hgt.zip");
                _logger.Debug("Found " + hgtZipFiles.Length + " files in: " + hgtFolder);
                foreach (var hgtZipFile in hgtZipFiles)
                {
                    _logger.Debug("Reading file " + hgtZipFile);
                    var byteArray = GetByteArrayFromZip(hgtZipFile);
                    int samples = (short)(Math.Sqrt(byteArray.Length / 2) + 0.5);
                    var bottomLeftLat = int.Parse(Path.GetFileName(hgtZipFile).Substring(1, 2));
                    var bottomLeftLng = int.Parse(Path.GetFileName(hgtZipFile).Substring(4, 3));
                    var key = new LatLng { Lat = bottomLeftLat, Lng = bottomLeftLng };
                    _elevationData[key] = new short[samples, samples];
                    for (int byteIndex = 0; byteIndex < byteArray.Length; byteIndex += 2)
                    {
                        short currentElevation = BitConverter.ToInt16(new[] { byteArray[byteIndex + 1], byteArray[byteIndex] }, 0);
                        _elevationData[key][(byteIndex / 2) / samples, (byteIndex / 2) % samples] = currentElevation;
                    }
                }
            });
        }

        public double GetElevation(double lat, double lng)
        {
            var key = new LatLng { Lat = (int)lat, Lng = (int)lng };
            if (_elevationData.ContainsKey(key) == false)
            {
                return 0;
            }
            var array = _elevationData[key];
            var samplesSize = 1.0 / array.GetLength(0);
            var latIndex = (array.GetLength(0) - 1) - (int)((lat - key.Lat) / samplesSize);
            var lngIndex = (int)((lng - key.Lng) / samplesSize);

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
