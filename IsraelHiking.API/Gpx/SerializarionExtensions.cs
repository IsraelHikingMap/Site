using System.IO;
using System.Xml.Serialization;
using IsraelHiking.API.Gpx.GpxTypes;
using NetTopologySuite.Features;
using NetTopologySuite.IO;
using Newtonsoft.Json;

namespace IsraelHiking.API.Gpx
{
    public static class SerializarionExtensions
    {
        public static byte[] ToBytes(this FeatureCollection featureCollection)
        {
            using (var outputStream = new MemoryStream())
            {
                var writer = new StreamWriter(outputStream);
                var jsonWriter = new JsonTextWriter(writer);
                var serializer = new GeoJsonSerializer();
                serializer.Serialize(jsonWriter, featureCollection);
                jsonWriter.Flush();
                return outputStream.ToArray();
            }
        }

        public static FeatureCollection ToFeatureCollection(this byte[] featureCollectionContent)
        {
            using (var stream = new MemoryStream(featureCollectionContent))
            {
                var serializer = new GeoJsonSerializer();
                using (var streamReader = new StreamReader(stream))
                using (var jsonTextReader = new JsonTextReader(streamReader))
                {
                    return serializer.Deserialize<FeatureCollection>(jsonTextReader);
                }
            }
        }

        public static gpxType ToGpx(this byte[] gpxContent)
        {
            using (var stream = new MemoryStream(gpxContent))
            {
                var xmlSerializer = new XmlSerializer(typeof(gpxType));
                return xmlSerializer.Deserialize(stream) as gpxType;
            }
        }

        public static byte[] ToBytes(this gpxType gpx)
        {
            using (var outputStream = new MemoryStream())
            {
                var xmlSerializer = new XmlSerializer(typeof(gpxType));
                xmlSerializer.Serialize(outputStream, gpx);
                return outputStream.ToArray();
            }
        }
    }
}
