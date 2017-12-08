using System;
using System.Collections.Generic;
using System.Drawing;
using System.Drawing.Drawing2D;
using System.Drawing.Imaging;
using System.Globalization;
using System.IO;
using System.Linq;
using System.Threading.Tasks;
using IsraelHiking.Common;
using IsraelHiking.DataAccessInterfaces;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace IsraelHiking.API.Services
{
    internal class BackgroundImage
    {
        public Image Image { get; set; }
        public Point TopLeft { get; set; }
        public Point Tiles { get; set; }
        public double N { get; set; }
        public int Zoom { get; set; }
    }

    internal class ImageWithOffset {
        public Image Image { get; set; }
        public Point Offset { get; set; }
    }

    ///<inheritdoc />
    public class ImageCreationService : IImageCreationService
    {
        private const int TILE_SIZE = 256; // pixels
        private const int NUMBER_OF_TILES_FOR_IMAGE_X = 4; // no units
        private const int NUMBER_OF_TILES_FOR_IMAGE_Y = 2; // no units
        private const int TARGET_TILE_SIZE_X = TILE_SIZE * NUMBER_OF_TILES_FOR_IMAGE_X; // pixels
        private const int TARGET_TILE_SIZE_Y = TILE_SIZE * NUMBER_OF_TILES_FOR_IMAGE_X; // pixels
        private const float CIRCLE_SIZE_X = 24; // pixels
        private const float CIRCLE_SIZE_Y = 28; // pixels
        private const float PEN_WIDTH = 13; // pixels
        private const int MAX_ZOOM = 16;
        
        private readonly IRemoteFileFetcherGateway _remoteFileFetcherGateway;
        private readonly ILogger _logger;

        private Pen _outLinerPen;
        private Pen _startRoutePen;
        private Pen _endRoutePen;
        private Brush _circleFillBrush;
        private readonly Color[] _routeColors;

        /// <summary>
        /// Contstructor, creates relevant colors and brushes accoridng to configuration
        /// </summary>
        /// <param name="httpGatewayFactory"></param>
        /// <param name="options"></param>
        /// <param name="logger"></param>
        public ImageCreationService(IHttpGatewayFactory httpGatewayFactory, IOptions<ConfigurationData> options, ILogger logger)
        {
            _remoteFileFetcherGateway = httpGatewayFactory.CreateRemoteFileFetcherGateway(null);
            _logger = logger;
            _outLinerPen = new Pen(Color.White, PEN_WIDTH + 8) { LineJoin = LineJoin.Bevel };
            _circleFillBrush = new SolidBrush(Color.White);
            _startRoutePen = new Pen(Color.Green, 7);
            _endRoutePen = new Pen(Color.Red, 7);
            _routeColors = options.Value.Colors.Select(c => FromColorString(c)).ToArray();
        }

        ///<inheritdoc />
        public async Task<byte[]> Create(DataContainer dataContainer)
        {
            _logger.LogDebug("Creating image for thumbnail started.");
            var allLocations = dataContainer.Routes.SelectMany(r => r.Segments).SelectMany(s => s.Latlngs).ToArray();
            if (!allLocations.Any())
            {
                allLocations = new[] { dataContainer.NorthEast, dataContainer.SouthWest };
            }
            var addressTemplates = GetAddressTemplates(dataContainer);
            var backgroundImage = await GetBackGroundImage(addressTemplates, allLocations);
            DrawRoutesOnImage(backgroundImage, dataContainer);
            var resizedForFacebook = new Bitmap(backgroundImage.Image, new Size(600, 315));
            var imageStream = new MemoryStream();
            resizedForFacebook.Save(imageStream, ImageFormat.Png);
            _logger.LogDebug("Creating image for thumbnail completed.");
            return imageStream.ToArray();
        }

        private BackgroundImage InitBackgroundImageTiles(LatLng[] allLocations)
        {
            var zoom = MAX_ZOOM;
            var n = Math.Pow(2, zoom);
            var tiles = new Point
            {
                X = (int)Math.Ceiling(Math.Ceiling(GetXTile(allLocations.Max(l => l.Lng), n)) - Math.Floor(GetXTile(allLocations.Min(l => l.Lng), n))),
                Y = (int)Math.Ceiling(Math.Ceiling(GetYTile(allLocations.Min(l => l.Lat), n)) - Math.Floor(GetYTile(allLocations.Max(l => l.Lat), n)))
            };
            while (tiles.X > NUMBER_OF_TILES_FOR_IMAGE_X || tiles.Y > NUMBER_OF_TILES_FOR_IMAGE_Y)
            {
                zoom--;
                n = Math.Pow(2, zoom);
                tiles.X = (int)Math.Ceiling(Math.Ceiling(GetXTile(allLocations.Max(l => l.Lng), n)) - Math.Floor(GetXTile(allLocations.Min(l => l.Lng), n)));
                tiles.Y = (int)Math.Ceiling(Math.Ceiling(GetYTile(allLocations.Min(l => l.Lat), n)) - Math.Floor(GetYTile(allLocations.Max(l => l.Lat), n)));
            }
            return new BackgroundImage
            {
                Tiles = tiles,
                Zoom = zoom,
                N = n
            };
        }

        private async Task<BackgroundImage> GetBackGroundImage(string[] addressTemplates, LatLng[] allLocations)
        {
            var backgroundImage = InitBackgroundImageTiles(allLocations);
            var topLeft = new Point((int)GetXTile(allLocations.Min(l => l.Lng), backgroundImage.N), (int)GetYTile(allLocations.Max(l => l.Lat), backgroundImage.N));
            var bottomRight = new Point((int)GetXTile(allLocations.Max(l => l.Lng), backgroundImage.N), (int)GetYTile(allLocations.Min(l => l.Lat), backgroundImage.N));
            if (backgroundImage.Tiles.X == 2 && backgroundImage.Tiles.Y == 1)
            {
                // no need to do anything.
            }
            else if (backgroundImage.Tiles.X == 1 && backgroundImage.Tiles.Y == 1)
            {
                backgroundImage.Tiles = new Point(2, 1);
                bottomRight.X++;
            }
            else
            {
                backgroundImage.Tiles = new Point(NUMBER_OF_TILES_FOR_IMAGE_X, NUMBER_OF_TILES_FOR_IMAGE_Y);
                UpdateImageRectangle(ref topLeft, ref bottomRight);
            }
            backgroundImage.TopLeft = topLeft;
            backgroundImage.Image = await CreateSingleImageFromTiles(topLeft, bottomRight, backgroundImage.Zoom, addressTemplates);
            return backgroundImage;
        }

        private async Task<Image> CreateSingleImageFromTiles(Point topLeft, Point bottomRight, int zoom, string[] addressTemplates)
        {
            var bitmap = new Bitmap(TARGET_TILE_SIZE_X, TARGET_TILE_SIZE_Y);
            var verticalTiles = bottomRight.Y - topLeft.Y + 1;
            var horizontalTiles = bottomRight.X - topLeft.X + 1;
            var targetSizeX = TARGET_TILE_SIZE_X / horizontalTiles;
            var targetSizeY = TARGET_TILE_SIZE_Y / verticalTiles;

            var tasks = new List<Task<ImageWithOffset>>();
            foreach (var addressTemplate in addressTemplates)
            {
                for (int x = 0; x < horizontalTiles; x++)
                {
                    for (int y = 0; y < verticalTiles; y++)
                    {
                        var task = GetTileImage(topLeft, new Point(x, y), zoom, addressTemplate);
                        tasks.Add(task);
                    }
                }
            }

            var imagesWithOffsets = await Task.WhenAll(tasks);
            using (var graphics = Graphics.FromImage(bitmap))
            {
                foreach (var imageWithOffset in imagesWithOffsets)
                {
                    graphics.DrawImage(imageWithOffset.Image,
                        new Rectangle(imageWithOffset.Offset.X * targetSizeX, imageWithOffset.Offset.Y * targetSizeY, targetSizeX, targetSizeY),
                        new Rectangle(0, 0, imageWithOffset.Image.Width, imageWithOffset.Image.Height),
                        GraphicsUnit.Pixel);
                }
                
            }
            return bitmap;
        }

        private static string[] GetAddressTemplates(DataContainer dataContainer)
        {
            var address = string.IsNullOrWhiteSpace(dataContainer.BaseLayer.Address)
                ? "https://israelhiking.osm.org.il/Hebrew/tiles/{z}/{x}/{y}.png"
                : dataContainer.BaseLayer.Address;

            var addressTemplates = new List<string> {FixAdrressTemplate(address)};
            foreach (var layerData in dataContainer.Overlays ?? new List<LayerData>())
            {
                if (!string.IsNullOrWhiteSpace(layerData.Address))
                {
                    addressTemplates.Add(FixAdrressTemplate(layerData.Address));
                }
            }
            return addressTemplates.ToArray();
        }

        private static string FixAdrressTemplate(string addressTemplate)
        {
            var address = addressTemplate.Trim().ToLower();
            if (address.StartsWith("http") == false && address.StartsWith("www") == false)
            {
                address = "https://israelhiking.osm.org.il" + address;
            }
            return address;
        }

        private void DrawRoutesOnImage(BackgroundImage backgroundImage, DataContainer dataContainer)
        {
            using (var graphics = Graphics.FromImage(backgroundImage.Image))
            {
                var routeColorIndex = 0;
                // HM TODO: add markers?
                foreach (var route in dataContainer.Routes)
                {
                    var points = route.Segments.SelectMany(s => s.Latlngs).Select(l => ConvertLatLngToPoint(l, backgroundImage)).ToArray();
                    if (!points.Any())
                    {
                        continue;
                    }
                    var lineColor = _routeColors[routeColorIndex++];
                    routeColorIndex = routeColorIndex % _routeColors.Length;
                    if (!string.IsNullOrEmpty(route.Color))
                    {
                        lineColor = FromColorString(route.Color, route.Opacity);
                    }
                    graphics.DrawLines(_outLinerPen, points);
                    var linePen = new Pen(lineColor, PEN_WIDTH) { LineJoin = LineJoin.Bevel };
                    graphics.DrawLines(linePen, points);
                    graphics.FillEllipse(_circleFillBrush, points.First().X - CIRCLE_SIZE_X / 2, points.First().Y - CIRCLE_SIZE_Y / 2, CIRCLE_SIZE_X, CIRCLE_SIZE_Y);
                    graphics.DrawEllipse(_startRoutePen, points.First().X - CIRCLE_SIZE_X / 2, points.First().Y - CIRCLE_SIZE_Y / 2, CIRCLE_SIZE_X, CIRCLE_SIZE_Y);
                    graphics.FillEllipse(_circleFillBrush, points.Last().X - CIRCLE_SIZE_X / 2, points.Last().Y - CIRCLE_SIZE_Y / 2, CIRCLE_SIZE_X, CIRCLE_SIZE_Y);
                    graphics.DrawEllipse(_endRoutePen, points.Last().X - CIRCLE_SIZE_X / 2, points.Last().Y - CIRCLE_SIZE_Y / 2, CIRCLE_SIZE_X, CIRCLE_SIZE_Y);
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

        private async Task<ImageWithOffset> GetTileImage(Point topLeft, Point offset, int zoom, string addressTemplate)
        {
            var file = addressTemplate.Replace("{z}", zoom.ToString())
                        .Replace("{zoom}", zoom.ToString())
                        .Replace("{x}", (topLeft.X + offset.X).ToString())
                        .Replace("{y}", (topLeft.Y + offset.Y).ToString());
            var fileResponse = await _remoteFileFetcherGateway.GetFileContent(file);

            return new ImageWithOffset
            {
                Image = fileResponse.Content.Any()
                    ? Image.FromStream(new MemoryStream(fileResponse.Content), true)
                    : new Bitmap(TILE_SIZE, TILE_SIZE),
                Offset = offset
            };
        }

        private PointF ConvertLatLngToPoint(LatLng latLng, BackgroundImage backgroundImage)
        {
            var x = (float)((GetXTile(latLng.Lng, backgroundImage.N) - backgroundImage.TopLeft.X) * TARGET_TILE_SIZE_X / backgroundImage.Tiles.X);
            var y = (float)((GetYTile(latLng.Lat, backgroundImage.N) - backgroundImage.TopLeft.Y) * TARGET_TILE_SIZE_Y / backgroundImage.Tiles.Y);
            return new PointF(x, y);
        }

        private void UpdateImageRectangle(ref Point topLeft, ref Point bottomRight)
        {
            if (bottomRight.X - topLeft.X + 1 < NUMBER_OF_TILES_FOR_IMAGE_X)
            {
                bottomRight.X++;
            }
            if (bottomRight.X - topLeft.X + 1 < NUMBER_OF_TILES_FOR_IMAGE_X)
            {
                topLeft.X--;
            }
            if (bottomRight.X - topLeft.X + 1 < NUMBER_OF_TILES_FOR_IMAGE_X)
            {
                bottomRight.X++;
            }

            if (bottomRight.Y - topLeft.Y + 1 < NUMBER_OF_TILES_FOR_IMAGE_Y)
            {
                topLeft.Y--;
            }
        }

        private Color FromColorString(string colorString, double? opacity = null)
        {
            if (colorString.StartsWith("#"))
            {
                var hexNumberString = colorString.Replace("#", "");
                if (hexNumberString.Length == 6)
                {
                    var alpha = ((int)Math.Round((opacity ?? 1.0) * 255)).ToString("X2");
                    hexNumberString = alpha + hexNumberString;
                }
                return Color.FromArgb(int.Parse(hexNumberString, NumberStyles.HexNumber));
            }
            return Color.FromName(colorString);
        }

        /// <summary>
        /// Main dispose method
        /// </summary>
        public void Dispose()
        {
            Dispose(true);
            GC.SuppressFinalize(this);
        }

        /// <summary>
        /// Dispose method, following the dispose pattern
        /// </summary>
        /// <param name="disposing"></param>
        protected virtual void Dispose(bool disposing)
        {
            if (!disposing)
            {
                return;
            }
            if (_circleFillBrush != null)
            {
                _circleFillBrush.Dispose();
                _circleFillBrush = null;
            }
            if (_endRoutePen != null)
            {
                _endRoutePen.Dispose();
                _endRoutePen = null;
            }
            if (_outLinerPen != null)
            {
                _outLinerPen.Dispose();
                _outLinerPen = null;
            }
            if (_startRoutePen != null)
            {
                _startRoutePen.Dispose();
                _startRoutePen = null;
            }
        }
    }
}
