using GeoJSON.Net.Geometry;
using System;
using System.Collections.Generic;
using System.Configuration;
using System.IO;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace IsraelHiking.DataAccess
{
    public class ElevationDataStorage
    {
        private static ElevationDataStorage _instance;
        private SortedDictionary<double, SortedDictionary<double, double>> elevationData;

        private ElevationDataStorage()
        {
            var hgtFolder = ConfigurationManager.AppSettings["serverRoot"].ToString() + ConfigurationManager.AppSettings["hgtFolder"].ToString();
            var hgtFiles = Directory.GetFiles(hgtFolder, "*.hgt");
            elevationData = new SortedDictionary<double, SortedDictionary<double, double>>();
            foreach (var hgtFile in hgtFiles)
            {
                var byteArray = File.ReadAllBytes(hgtFile);
                int samples = (int)(Math.Sqrt(byteArray.Length / 2) + 0.5);
                var topLeftLat = int.Parse(Path.GetFileName(hgtFile).Substring(1, 2)) + 1;
                var topLeftLng = int.Parse(Path.GetFileName(hgtFile).Substring(4, 3));
                for (int byteIndex = 0; byteIndex < byteArray.Length; byteIndex += 2)
                {
                    int currentElevation = BitConverter.ToInt16(new[] { byteArray[byteIndex + 1], byteArray[byteIndex] }, 0);
                    double lat = topLeftLat - (1.0 / samples) * (((byteIndex / 2) / samples) + 1);
                    double lng = topLeftLng + (1.0 / samples) * ((byteIndex / 2) % samples);
                    if (elevationData.ContainsKey(lat) == false)
                    {
                        elevationData[lat] = new SortedDictionary<double, double>();
                    }
                    elevationData[lat][lng] = currentElevation;
                }
            }
        }

        public static ElevationDataStorage Instance { get
            {
                if (_instance == null)
                {
                    _instance = new ElevationDataStorage();
                }
                return _instance;
            }
        }

        public double GetElevation(double lat, double lng)
        {
            foreach (var keyValueLat in elevationData)
            {
                if (keyValueLat.Key < lat)
                {
                    continue;
                }

                foreach (var keyValueLng in elevationData[keyValueLat.Key])
                {
                    if (keyValueLng.Key < lng)
                    {
                        continue;
                    }
                    return elevationData[keyValueLat.Key][keyValueLng.Key];
                }
                break;
            }

            return 0;
        }
    }
}
