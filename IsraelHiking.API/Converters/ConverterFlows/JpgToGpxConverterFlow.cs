using IsraelHiking.API.Gpx;
using IsraelHiking.DataAccessInterfaces;
using NetTopologySuite.IO;
using System.Collections.Immutable;
using System.IO;
using System.Linq;

namespace IsraelHiking.API.Converters.ConverterFlows
{
    /// <summary>
    /// This class is responsible to convert jpg images to gpx - while uploading the image to imgur
    /// </summary>
    public class JpgToGpxConverterFlow : IConverterFlowItem
    {
        private readonly IGpsBabelGateway _gpsBabelGateway;
        private readonly IImgurGateway _imgurGateway;

        /// <inheritdoc />
        public string Input => FlowFormats.JPG_BABEL_FORMAT;
        /// <inheritdoc />
        public string Output => FlowFormats.GPX_BABEL_FORMAT;

        /// <summary>
        /// constructor
        /// </summary>
        /// <param name="gpsBabelGateway"></param>
        /// <param name="imgurGateway"></param>
        public JpgToGpxConverterFlow(IGpsBabelGateway gpsBabelGateway, IImgurGateway imgurGateway)
        {
            _gpsBabelGateway = gpsBabelGateway;
            _imgurGateway = imgurGateway;
        }

        /// <inheritdoc />
        public byte[] Transform(byte[] content)
        {
            var gpxBytes = _gpsBabelGateway.ConvertFileFromat(content, Input, Output).Result;
            var gpx = gpxBytes.ToGpx();
            if (gpx.Waypoints == null || !gpx.Waypoints.Any())
            {
                return gpx.ToBytes();
            }
            using var stream = new MemoryStream(content);
            var link = _imgurGateway.UploadImage(stream).Result;
            var wayPoint = gpx.Waypoints.First();
            var gpxObject = new GpxFile
            {
                Metadata = new GpxMetadata(GpxDataContainerConverter.ISRAEL_HIKING_MAP + "_jpg")
            };
            gpxObject.Waypoints.Add(
                new GpxWaypoint(wayPoint.Longitude, wayPoint.Latitude)
                    .WithLinks(new[] { new GpxWebLink(link, "", "image/jpeg") }.ToImmutableArray())
            );
            return gpxObject.ToBytes();
        }

        
    }
}
