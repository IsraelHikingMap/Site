using Ionic.Zip;
using System;
using System.Collections.Generic;
using System.Configuration;
using System.IO;
using System.Linq;
using System.Threading.Tasks;

namespace IsraelHiking.DataAccess
{
    internal class LatLngKey : IEquatable<LatLngKey>
    {
        public double Lat { get; set; }
        public double Lng { get; set; }

        public bool Equals(LatLngKey other)
        {
            return other.Lat == Lat && other.Lng == Lng;
        }

        public override int GetHashCode()
        {
            return Lat.GetHashCode() ^ Lng.GetHashCode();
        }

        public override bool Equals(object obj)
        {
            var other = obj as LatLngKey;
            if (other == null)
            {
                return false;
            }
            return Equals(other);
        }
    }

    public class ElevationDataStorage
    {
        private static ElevationDataStorage _instance;
        private readonly Dictionary<LatLngKey, short[,]> _elevationData;
        private readonly Logger _logger;

        private ElevationDataStorage()
        {
            _logger = new Logger();
            _elevationData = new Dictionary<LatLngKey, short[,]>();
        }

        public static ElevationDataStorage Instance
        {
            get
            {
                if (_instance == null)
                {
                    _instance = new ElevationDataStorage();
                }
                return _instance;
            }
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
                    var key = new LatLngKey { Lat = bottomLeftLat, Lng = bottomLeftLng };
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
            var key = new LatLngKey { Lat = (int)lat, Lng = (int)lng };
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
