using System;
using System.Collections.Generic;
using System.Drawing;
using System.Drawing.Drawing2D;
using System.Drawing.Imaging;
using System.IO;
using System.Linq;
using System.Threading.Tasks;
using IsraelHiking.Common;
using IsraelHiking.DataAccessInterfaces;

namespace IsraelHiking.API.Services
{
    internal class BackgroundImage
    {
        public Image Image { get; set; }
        public int X { get; set; }
        public int Y { get; set; }
        public double N { get; set; }
        public int Ratio { get; set; }
    }

    public class ImageCreationService : IImageCreationService
    {
        private const int TILE_SIZE = 256; // pixels
        private const int TARGET_TILE_SIZE = 256 * 4; // pixels
        private const float CIRCLE_SIZE = 12; // pixels
        private const int MAX_ZOOM = 16;
        private const int NUMBER_OF_TILES_FOR_IMAGE = 4;
        private readonly IRemoteFileFetcherGateway _remoteFileFetcherGateway;

        private int _reoutePenIndex;
        private readonly Pen _outLinerPen;
        private readonly Pen[] _routePenArray;
        private readonly Pen _startRoutePen;
        private readonly Pen _endRoutePen;
        private readonly Brush _circleFillBrush;


        public ImageCreationService(IRemoteFileFetcherGateway remoteFileFetcherGateway)
        {
            _reoutePenIndex = 0;
            _remoteFileFetcherGateway = remoteFileFetcherGateway;
            _outLinerPen = new Pen(Color.White, 11) { LineJoin = LineJoin.Bevel };
            _routePenArray = new[]
            {
                new Pen(Color.Blue, 7) {LineJoin = LineJoin.Bevel},
                new Pen(Color.Red, 7) {LineJoin = LineJoin.Bevel},
                new Pen(Color.Orange, 7) {LineJoin = LineJoin.Bevel},
                new Pen(Color.Pink, 7) {LineJoin = LineJoin.Bevel},
                new Pen(Color.Green, 7) {LineJoin = LineJoin.Bevel},
                new Pen(Color.Purple, 7) {LineJoin = LineJoin.Bevel},
                new Pen(Color.Turquoise, 7) {LineJoin = LineJoin.Bevel},
                new Pen(Color.Yellow, 7) {LineJoin = LineJoin.Bevel},
                new Pen(Color.Brown, 7) {LineJoin = LineJoin.Bevel},
                new Pen(Color.Cyan, 7) {LineJoin = LineJoin.Bevel},
                new Pen(Color.Gray, 7) {LineJoin = LineJoin.Bevel},
                new Pen(Color.FromArgb(255, 16, 16, 16), 7) {LineJoin = LineJoin.Bevel}
            };

            _circleFillBrush = Brushes.White;
            _startRoutePen = new Pen(Color.Green, 5);
            _endRoutePen = new Pen(Color.Red, 5);
        }

        public async Task<byte[]> Create(DataContainer dataContainer)
        {
            var allLocations = dataContainer.routes.SelectMany(r => r.segments).SelectMany(s => s.latlngzs.OfType<LatLng>()).ToArray();
            if (!allLocations.Any())
            {
                allLocations = new[] { dataContainer.northEast, dataContainer.southWest };
            }
            var backgroundImage = await GetBackGroundImage(GetAddressTemplate(dataContainer), allLocations);
            var points = dataContainer.routes
                    .Select(r => r.segments.SelectMany(s => s.latlngzs)
                                .Select(l => ConvertLatLngZToPoint(l, backgroundImage))
                                .ToArray());
            DrawRouteOnImage(backgroundImage.Image, points);
            var resizedForFacebook = new Bitmap(backgroundImage.Image, new Size(600, 315));
            var imageStream = new MemoryStream();
            resizedForFacebook.Save(imageStream, ImageFormat.Png);
            return imageStream.ToArray();
        }

        private int GetDeltaAndZoom(LatLng[] allLocations, out int zoom)
        {
            zoom = MAX_ZOOM;
            var n = Math.Pow(2, zoom);
            var xTilesDelta = Math.Ceiling(GetXTile(allLocations.Max(l => l.lng), n)) - Math.Floor(GetXTile(allLocations.Min(l => l.lng), n));
            var yTilesDelta = Math.Ceiling(GetYTile(allLocations.Min(l => l.lat), n)) - Math.Floor(GetYTile(allLocations.Max(l => l.lat), n));
            var maxTilesDelta = (int)Math.Max(xTilesDelta, yTilesDelta);
            while (maxTilesDelta > NUMBER_OF_TILES_FOR_IMAGE)
            {
                maxTilesDelta = (maxTilesDelta + 1) / 2;
                zoom--;
            }
            return maxTilesDelta;
        }

        private async Task<BackgroundImage> GetBackGroundImage(string addressTemplate, LatLng[] allLocations)
        {
            int zoom;
            int maxTilesDelta = GetDeltaAndZoom(allLocations, out zoom);
            var n = Math.Pow(2, zoom);
            var left = (int)GetXTile(allLocations.Min(l => l.lng), n);
            var top = (int)GetYTile(allLocations.Max(l => l.lat), n);
            var right = (int)GetXTile(allLocations.Max(l => l.lng), n);
            var bottom = (int)GetYTile(allLocations.Min(l => l.lat), n);
            int ratio = maxTilesDelta;
            switch (maxTilesDelta)
            {
                case 1:
                    break;
                case 2:
                    if (left == right)
                    {
                        right++;
                    }
                    if (top == bottom)
                    {
                        top--;
                    }
                    break;
                default:
                    ratio = NUMBER_OF_TILES_FOR_IMAGE;
                    if (right - left + 1 < NUMBER_OF_TILES_FOR_IMAGE)
                    {
                        right++;
                    }
                    if (right - left + 1 < NUMBER_OF_TILES_FOR_IMAGE)
                    {
                        left--;
                    }
                    if (right - left + 1 < NUMBER_OF_TILES_FOR_IMAGE)
                    {
                        right++;
                    }

                    if (bottom - top + 1 < NUMBER_OF_TILES_FOR_IMAGE)
                    {
                        top--;
                    }
                    if (bottom - top + 1 < NUMBER_OF_TILES_FOR_IMAGE)
                    {
                        bottom++;
                    }
                    if (bottom - top + 1 < NUMBER_OF_TILES_FOR_IMAGE)
                    {
                        top--;
                    }
                    break;
            }
            return new BackgroundImage
            {
                Image = await CreateSingleImageFromTiles(top, left, bottom, right, zoom, addressTemplate),
                N = Math.Pow(2, zoom),
                X = left,
                Y = top,
                Ratio = ratio
            };
        }

        private async Task<Image> CreateSingleImageFromTiles(int top, int left, int bottom, int right, int zoom, string addressTemplate)
        {
            var bitmap = new Bitmap(TARGET_TILE_SIZE, TARGET_TILE_SIZE);
            var verticalTiles = (bottom - top + 1);
            var targetSize = TARGET_TILE_SIZE / verticalTiles;
            using (var graphics = Graphics.FromImage(bitmap))
            {
                for (int x = 0; x < right - left + 1; x++)
                {
                    for (int y = 0; y < verticalTiles; y++)
                    {
                        graphics.DrawImage(await GetTileImage(left + x, top + y, zoom, addressTemplate),
                            new Rectangle(x * targetSize, y * targetSize, targetSize, targetSize),
                            new Rectangle(0, 0, TILE_SIZE, TILE_SIZE),
                            GraphicsUnit.Pixel);
                    }
                }
            }
            return bitmap;
        }

        private static string GetAddressTemplate(DataContainer dataContainer)
        {
            var address = string.IsNullOrWhiteSpace(dataContainer.baseLayer.address)
                ? "http://israelhiking.osm.org.il/tiles/{z}/{x}/{y}.png"
                : dataContainer.baseLayer.address;
            if (address.StartsWith("http") == false && address.StartsWith("www") == false)
            {
                address = "http://israelhiking.osm.org.il/" + address;
            }
            return address;
        }

        private void DrawRouteOnImage(Image image, IEnumerable<PointF[]> pointsByRoute)
        {
            using (var graphics = Graphics.FromImage(image))
            {
                // HM TODO: add markers?
                foreach (var points in pointsByRoute)
                {
                    if (!points.Any())
                    {
                        continue;
                    }
                    graphics.DrawLines(_outLinerPen, points);
                    graphics.DrawLines(_routePenArray[_reoutePenIndex++], points);
                    graphics.FillEllipse(_circleFillBrush, points.First().X - CIRCLE_SIZE / 2, points.First().Y - CIRCLE_SIZE / 2, CIRCLE_SIZE, CIRCLE_SIZE);
                    graphics.DrawEllipse(_startRoutePen, points.First().X - CIRCLE_SIZE / 2, points.First().Y - CIRCLE_SIZE / 2, CIRCLE_SIZE, CIRCLE_SIZE);
                    graphics.FillEllipse(_circleFillBrush, points.Last().X - CIRCLE_SIZE / 2, points.Last().Y - CIRCLE_SIZE / 2, CIRCLE_SIZE, CIRCLE_SIZE);
                    graphics.DrawEllipse(_endRoutePen, points.Last().X - CIRCLE_SIZE / 2, points.Last().Y - CIRCLE_SIZE / 2, CIRCLE_SIZE, CIRCLE_SIZE);
                }
            }
        }

        private double GetXTile(double longitude, double n)
        {
            return n * ((longitude + 180.0) / 360.0);
        }
        private double GetYTile(double latitude, double n)
        {
            var latitudeInRadians = latitude * Math.PI / 180.0;
            return (n / 2) * (1 - Math.Log(Math.Tan(latitudeInRadians) + 1.0 / Math.Cos(latitudeInRadians)) / Math.PI);
        }

        private async Task<Image> GetTileImage(int x, int y, int zoom, string addressTemplate)
        {
            var file = addressTemplate.Replace("{z}", zoom.ToString())
                        .Replace("{zoom}", zoom.ToString())
                        .Replace("{x}", x.ToString())
                        .Replace("{y}", y.ToString());
            var fileResponse = await _remoteFileFetcherGateway.GetFileContent(file);
            return Image.FromStream(new MemoryStream(fileResponse.Content), true);
        }

        private PointF ConvertLatLngZToPoint(LatLngZ latLng, BackgroundImage backgroundImage)
        {
            var x = (float)((GetXTile(latLng.lng, backgroundImage.N) - backgroundImage.X) * TARGET_TILE_SIZE / backgroundImage.Ratio);
            var y = (float)((GetYTile(latLng.lat, backgroundImage.N) - backgroundImage.Y) * TARGET_TILE_SIZE / backgroundImage.Ratio);
            return new PointF(x, y);
        }
    }
}
