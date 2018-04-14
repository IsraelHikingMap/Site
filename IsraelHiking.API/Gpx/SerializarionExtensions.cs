using System.IO;
using System.Linq;
using System.Xml.Serialization;
using NetTopologySuite.Features;
using Newtonsoft.Json;
using NetTopologySuite.IO;

namespace IsraelHiking.API.Gpx
{
    /// <summary>
    /// This is a helper class to facilitate easier serializations
    /// </summary>
    public static class SerializarionExtensions
    {
        /// <summary>
        /// Convers <see cref="FeatureCollection"/> to <see cref="byte"/> array
        /// </summary>
        /// <param name="featureCollection">The <see cref="FeatureCollection"/></param>
        /// <returns>The <see cref="byte"/> array</returns>
        public static byte[] ToBytes(this FeatureCollection featureCollection)
        {
            using (var outputStream = new MemoryStream())
            {
                var writer = new StreamWriter(outputStream);
                var jsonWriter = new JsonTextWriter(writer);
                var serializer = GeoJsonSerializer.CreateDefault();
                serializer.Serialize(jsonWriter, featureCollection);
                jsonWriter.Flush();
                return outputStream.ToArray();
            }
        }

        /// <summary>
        /// Converts <see cref="byte"/> array to <see cref="FeatureCollection"/>
        /// </summary>
        /// <param name="featureCollectionContent">The <see cref="byte"/> array</param>
        /// <returns>The <see cref="FeatureCollection"/></returns>
        public static FeatureCollection ToFeatureCollection(this byte[] featureCollectionContent)
        {
            using (var stream = new MemoryStream(featureCollectionContent))
            {
                var serializer = GeoJsonSerializer.CreateDefault();
                using (var streamReader = new StreamReader(stream))
                using (var jsonTextReader = new JsonTextReader(streamReader))
                {
                    return serializer.Deserialize<FeatureCollection>(jsonTextReader);
                }
            }
        }

        /// <summary>
        /// Converts <see cref="byte"/> array to <see cref="gpxType"/>
        /// </summary>
        /// <param name="gpxContent">The <see cref="byte"/> array</param>
        /// <returns>The <see cref="gpxType"/></returns>
        public static gpxType ToGpx(this byte[] gpxContent)
        {
            using (var stream = new MemoryStream(gpxContent))
            {
                var xmlSerializer = new XmlSerializer(typeof(gpxType));
                return xmlSerializer.Deserialize(stream) as gpxType;
            }
        }

        /// <summary>
        /// Converts <see cref="gpxType"/> to <see cref="byte"/> array
        /// </summary>
        /// <param name="gpx">The <see cref="gpxType"/></param>
        /// <returns>The <see cref="byte"/> array</returns>
        public static byte[] ToBytes(this gpxType gpx)
        {
            using (var outputStream = new MemoryStream())
            {
                var xmlSerializer = new XmlSerializer(typeof(gpxType));
                var streamWriter = new StreamWriter(outputStream, System.Text.Encoding.UTF8);
                xmlSerializer.Serialize(streamWriter, gpx);
                return outputStream.ToArray();
            }
        }

        /// <summary>
        /// Updates the bounds of a <see cref="gpxType"/> object according to internal data
        /// </summary>
        /// <param name="gpx">The <see cref="gpxType"/></param>
        /// <returns>An updated <see cref="gpxType"/></returns>
        public static gpxType UpdateBounds(this gpxType gpx)
        {
            if (gpx.metadata?.bounds != null &&
                gpx.metadata.bounds.minlat != 0 &&
                gpx.metadata.bounds.maxlat != 0 &&
                gpx.metadata.bounds.minlon != 0 &&
                gpx.metadata.bounds.maxlon != 0)
            {
                return gpx;
            }
            var points = (gpx.rte ?? new rteType[0]).Where(r => r.rtept != null).SelectMany(r => r.rtept).ToArray();
            points = points.Concat(gpx.wpt ?? new wptType[0]).ToArray();
            points = points.Concat((gpx.trk ?? new trkType[0]).Where(r => r.trkseg != null).SelectMany(t => t.trkseg).SelectMany(s => s.trkpt)).ToArray();
            if (!points.Any())
            {
                return gpx;
            }
            if (gpx.metadata == null)
            {
                gpx.metadata = new metadataType {bounds = new boundsType()};
            }
            
            gpx.metadata.bounds = new boundsType
            {
                minlat = points.Min(p => p.lat),
                maxlat = points.Max(p => p.lat),
                minlon = points.Min(p => p.lon),
                maxlon = points.Max(p => p.lon)
            };
            return gpx;
        }
    }
}
