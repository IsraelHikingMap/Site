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
        public Point TopLeft { get; set; }
        public Point Tiles { get; set; }
        public double N { get; set; }
        public int Zoom { get; set; }
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

        private int _reoutePenIndex;
        private readonly Pen _outLinerPen;
        private readonly Pen[] _routePenArray;
        private readonly Pen _startRoutePen;
        private readonly Pen _endRoutePen;
        private readonly Brush _circleFillBrush;

        /// <summary>
        /// Contstructor, creates relevant colors and brushes
        /// </summary>
        /// <param name="httpGatewayFactory"></param>
        /// <param name="logger"></param>
        public ImageCreationService(IHttpGatewayFactory httpGatewayFactory, ILogger logger)
        {
            _reoutePenIndex = 0;
            _remoteFileFetcherGateway = httpGatewayFactory.CreateRemoteFileFetcherGateway(null);
            _logger = logger;
            _outLinerPen = new Pen(Color.White, PEN_WIDTH + 8) { LineJoin = LineJoin.Bevel };
            _routePenArray = new[]
            {
                new Pen(Color.Blue, PEN_WIDTH) {LineJoin = LineJoin.Bevel},
                new Pen(Color.Red, PEN_WIDTH) {LineJoin = LineJoin.Bevel},
                new Pen(Color.Orange, PEN_WIDTH) {LineJoin = LineJoin.Bevel},
                new Pen(Color.Pink, PEN_WIDTH) {LineJoin = LineJoin.Bevel},
                new Pen(Color.Green, PEN_WIDTH) {LineJoin = LineJoin.Bevel},
                new Pen(Color.Purple, PEN_WIDTH) {LineJoin = LineJoin.Bevel},
                new Pen(Color.Turquoise, PEN_WIDTH) {LineJoin = LineJoin.Bevel},
                new Pen(Color.Yellow, PEN_WIDTH) {LineJoin = LineJoin.Bevel},
                new Pen(Color.Brown, PEN_WIDTH) {LineJoin = LineJoin.Bevel},
                new Pen(Color.Cyan, PEN_WIDTH) {LineJoin = LineJoin.Bevel},
                new Pen(Color.Gray, PEN_WIDTH) {LineJoin = LineJoin.Bevel},
                new Pen(Color.FromArgb(255, 16, 16, 16), PEN_WIDTH) {LineJoin = LineJoin.Bevel}
            };

            _circleFillBrush = Brushes.White;
            _startRoutePen = new Pen(Color.Green, 7);
            _endRoutePen = new Pen(Color.Red, 7);
        }

        ///<inheritdoc />
        public async Task<byte[]> Create(DataContainer dataContainer)
        {
            _logger.Debug("Creating image for thumbnail started.");
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
            _logger.Debug("Creating image for thumbnail completed.");
            return imageStream.ToArray();
        }

        private BackgroundImage InitBackgroundImageTiles(LatLng[] allLocations)
        {
            var zoom = MAX_ZOOM;
            var n = Math.Pow(2, zoom);
            var tiles = new Point
            {
                X = (int)Math.Ceiling(Math.Ceiling(GetXTile(allLocations.Max(l => l.lng), n)) - Math.Floor(GetXTile(allLocations.Min(l => l.lng), n))),
                Y = (int)Math.Ceiling(Math.Ceiling(GetYTile(allLocations.Min(l => l.lat), n)) - Math.Floor(GetYTile(allLocations.Max(l => l.lat), n)))
            };
            while (tiles.X > NUMBER_OF_TILES_FOR_IMAGE_X || tiles.Y > NUMBER_OF_TILES_FOR_IMAGE_Y)
            {
                zoom--;
                n = Math.Pow(2, zoom);
                tiles.X = (int)Math.Ceiling(Math.Ceiling(GetXTile(allLocations.Max(l => l.lng), n)) - Math.Floor(GetXTile(allLocations.Min(l => l.lng), n)));
                tiles.Y = (int)Math.Ceiling(Math.Ceiling(GetYTile(allLocations.Min(l => l.lat), n)) - Math.Floor(GetYTile(allLocations.Max(l => l.lat), n)));
            }
            return new BackgroundImage
            {
                Tiles = tiles,
                Zoom = zoom,
                N = n
            };
        }

        private async Task<BackgroundImage> GetBackGroundImage(string addressTemplate, LatLng[] allLocations)
        {
            var backgroundImage = InitBackgroundImageTiles(allLocations);
            var topLeft = new Point((int)GetXTile(allLocations.Min(l => l.lng), backgroundImage.N), (int)GetYTile(allLocations.Max(l => l.lat), backgroundImage.N));
            var bottomRight = new Point((int)GetXTile(allLocations.Max(l => l.lng), backgroundImage.N), (int)GetYTile(allLocations.Min(l => l.lat), backgroundImage.N));
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
            backgroundImage.Image = await CreateSingleImageFromTiles(topLeft, bottomRight, backgroundImage.Zoom, addressTemplate);
            return backgroundImage;
        }

        private async Task<Image> CreateSingleImageFromTiles(Point topLeft, Point bottomRight, int zoom, string addressTemplate)
        {
            var bitmap = new Bitmap(TARGET_TILE_SIZE_X, TARGET_TILE_SIZE_Y);
            var verticalTiles = bottomRight.Y - topLeft.Y + 1;
            var horizontalTiles = bottomRight.X - topLeft.X + 1;
            var targetSizeX = TARGET_TILE_SIZE_X / horizontalTiles;
            var targetSizeY = TARGET_TILE_SIZE_Y / verticalTiles;
            using (var graphics = Graphics.FromImage(bitmap))
            {
                for (int x = 0; x < horizontalTiles; x++)
                {
                    for (int y = 0; y < verticalTiles; y++)
                    {
                        graphics.DrawImage(await GetTileImage(topLeft.X + x, topLeft.Y + y, zoom, addressTemplate),
                            new Rectangle(x * targetSizeX, y * targetSizeY, targetSizeX, targetSizeY),
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
                ? "http://israelhiking.osm.org.il/Hebrew/tiles/{z}/{x}/{y}.png"
                : dataContainer.baseLayer.address;
            if (address.StartsWith("http") == false && address.StartsWith("www") == false)
            {
                address = "http://israelhiking.osm.org.il" + address;
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

        private async Task<Image> GetTileImage(int x, int y, int zoom, string addressTemplate)
        {
            var file = addressTemplate.Replace("{z}", zoom.ToString())
                        .Replace("{zoom}", zoom.ToString())
                        .Replace("{x}", x.ToString())
                        .Replace("{y}", y.ToString());
            var fileResponse = await _remoteFileFetcherGateway.GetFileContent(file);
            return fileResponse.Content.Any() ? Image.FromStream(new MemoryStream(fileResponse.Content), true) : new Bitmap(TILE_SIZE, TILE_SIZE);
        }

        private PointF ConvertLatLngZToPoint(LatLngZ latLng, BackgroundImage backgroundImage)
        {
            var x = (float)((GetXTile(latLng.lng, backgroundImage.N) - backgroundImage.TopLeft.X) * TARGET_TILE_SIZE_X / backgroundImage.Tiles.X);
            var y = (float)((GetYTile(latLng.lat, backgroundImage.N) - backgroundImage.TopLeft.Y) * TARGET_TILE_SIZE_Y / backgroundImage.Tiles.Y);
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
    }
}
