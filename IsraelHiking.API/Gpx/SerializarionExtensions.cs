using System.Collections.Generic;
using System.Collections.Immutable;
using System.IO;
using System.Linq;
using System.Text;
using System.Xml;
using System.Xml.Linq;
using IsraelHiking.API.Converters;
using NetTopologySuite.Features;
using Newtonsoft.Json;
using NetTopologySuite.IO;

namespace IsraelHiking.API.Gpx
{
    /// <summary>
    /// This class allows reading a GPX file into <see cref="GpxMainObject"/> class
    /// </summary>
    internal class GpxVisitor : GpxVisitorBase
    {
        public GpxMainObject Gpx { get; }

        /// <summary>
        /// Constrcutor
        /// </summary>
        public GpxVisitor()
        {
            Gpx = new GpxMainObject();
        }

        /// <inheritdoc />
        public override void VisitMetadata(GpxMetadata metadata)
        {
            Gpx.Metadata = metadata;
        }

        /// <inheritdoc />
        public override void VisitWaypoint(GpxWaypoint point)
        {
            base.VisitWaypoint(point);
            Gpx.Waypoints.Add(point);
        }

        /// <inheritdoc />
        public override void VisitRoute(GpxRoute route)
        {
            base.VisitRoute(route);
            Gpx.Routes.Add(route);
        }

        /// <inheritdoc />
        public override void VisitTrack(GpxTrack track)
        {
            base.VisitTrack(track);
            Gpx.Tracks.Add(track);
        }
    }

    internal class IsraelHikingGpxExtensionReader : GpxExtensionReader
    {
        public string FromXml(IEnumerable<XElement> extensionElements, string elementName)
        {
            return extensionElements.FirstOrDefault(a => a.Name.LocalName == elementName)?.FirstNode?.ToString();
        }

        public override object ConvertTrackSegmentExtensionElement(IEnumerable<XElement> extensionElements)
        {
            return FromXml(extensionElements, "RoutingType");
        }

        public override object ConvertTrackExtensionElement(IEnumerable<XElement> extensionElements)
        {
            var opacityString = FromXml(extensionElements, "Opacity");
            var weightString = FromXml(extensionElements, "Weight");
            if (string.IsNullOrWhiteSpace(opacityString) || string.IsNullOrWhiteSpace(weightString))
            {
                return null;
            }
            return new ColorOpacityWeight
            {
                Color = FromXml(extensionElements, "Color"),
                Opacity = double.Parse(opacityString),
                Weight = int.Parse(weightString)
            };
        }
    }

    internal class IsraelHikingGpxExtensionWriter : GpxExtensionWriter
    {

        public override IEnumerable<XElement> ConvertTrackSegmentExtension(object extension)
        {
            return new[] {new XElement("RoutingType", extension.ToString()) };
        }

        public override IEnumerable<XElement> ConvertTrackExtension(object extension)
        {
            if (extension is ColorOpacityWeight colorOpacityWeight)
            {
                return new[]
                {
                    new XElement("Color", colorOpacityWeight.Color),
                    new XElement("Opacity", colorOpacityWeight.Opacity),
                    new XElement("Weight", colorOpacityWeight.Weight)
                };
            }
            return new XElement[0];
        }
    }

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
        /// Converts <see cref="byte"/> array to <see cref="GpxMainObject"/>
        /// </summary>
        /// <param name="gpxContent">The <see cref="byte"/> array</param>
        /// <returns>The <see cref="GpxMainObject"/></returns>
        public static GpxMainObject ToGpx(this byte[] gpxContent)
        {
            using (var stream = new MemoryStream(gpxContent))
            {
                var reader = new XmlTextReader(stream);
                var visitor = new GpxVisitor();
                GpxReader.Read(reader, new GpxReaderSettings
                {
                    ExtensionReader = new IsraelHikingGpxExtensionReader()
                }, visitor);
                return visitor.Gpx;
            }
        }

        /// <summary>
        /// Converts <see cref="GpxMainObject"/> to <see cref="byte"/> array
        /// </summary>
        /// <param name="gpx">The <see cref="GpxMainObject"/></param>
        /// <returns>The <see cref="byte"/> array</returns>
        public static byte[] ToBytes(this GpxMainObject gpx)
        {
            using (var outputStream = new MemoryStream())
            {
                var xmlWriterSettings = new XmlWriterSettings
                {
                    Indent = true,
                    IndentChars = "\t",
                    Encoding = Encoding.UTF8
                };
                var xmlWriter = XmlWriter.Create(outputStream, xmlWriterSettings);
                GpxWriter.Write(xmlWriter, new GpxWriterSettings
                {
                    ExtensionWriter = new IsraelHikingGpxExtensionWriter()
                }, gpx.Metadata, gpx.Waypoints, gpx.Routes, gpx.Tracks, null);
                xmlWriter.Flush();
                return outputStream.ToArray();
            }
        }

        /// <summary>
        /// Updates the bounds of a <see cref="GpxMainObject"/> object according to internal data
        /// </summary>
        /// <param name="gpx">The <see cref="GpxMainObject"/></param>
        /// <returns>An updated <see cref="GpxMainObject"/></returns>
        public static GpxMainObject UpdateBounds(this GpxMainObject gpx)
        {
            if (gpx.Metadata?.Bounds != null &&
                gpx.Metadata.Bounds.MinLatitude.Value != 0.0 &&
                gpx.Metadata.Bounds.MaxLatitude.Value != 0.0 &&
                gpx.Metadata.Bounds.MinLongitude.Value != 0.0 &&
                gpx.Metadata.Bounds.MaxLongitude.Value != 0.0)
            {
                return gpx;
            }
            var points = (gpx.Routes ?? new List<GpxRoute>()).Where(r => r.Waypoints != null).SelectMany(r => r.Waypoints).ToArray();
            points = points.Concat(gpx.Waypoints ?? new List<GpxWaypoint>()).ToArray();
            points = points.Concat((gpx.Tracks ?? new List<GpxTrack>()).Where(r => r.Segments != null).SelectMany(t => t.Segments).SelectMany(s => s.Waypoints)).ToArray();
            if (!points.Any())
            {
                return gpx;
            }

            var boundingBox = new GpxBoundingBox(
                minLatitude: new GpxLatitude(points.Min(p => p.Latitude.Value)), 
                maxLatitude: new GpxLatitude(points.Max(p => p.Latitude.Value)),
                minLongitude: new GpxLongitude(points.Min(p => p.Longitude.Value)), 
                maxLongitude: new GpxLongitude(points.Max(p => p.Longitude.Value))
            );
            gpx.Metadata = gpx.Metadata == null 
                ? new GpxMetadata(null, null, null, null, null, ImmutableArray<GpxWebLink>.Empty, null, null, boundingBox, null) 
                : new GpxMetadata(gpx.Metadata.Creator, gpx.Metadata.Name, gpx.Metadata.Description, gpx.Metadata.Author, gpx.Metadata.Copyright, gpx.Metadata.Links, gpx.Metadata.CreationTime, gpx.Metadata.Keywords, boundingBox, gpx.Metadata.Extensions);
            return gpx;
        }
    }
}
