using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Threading.Tasks;
using IsraelHiking.Common;
using IsraelHiking.DataAccessInterfaces;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using SixLabors.ImageSharp;
using SixLabors.ImageSharp.PixelFormats;
using SixLabors.ImageSharp.Processing;
using SixLabors.Primitives;
using SixLabors.Shapes;

namespace IsraelHiking.API.Services
{
    internal class ImageCreationContext
    {
        public Image Image { get; set; }
        public Point TopLeft { get; set; }
        public Point BottomRight { get; set; }
        public int Width { get; set; }
        public int Height { get; set; }
        public int Zoom { get; set; }
        public double N { get; set; }
        public DataContainer DataContainer { get; set; }
        public AddressAndOpacity[] AddressesTemplates { get; set; }
    }

    internal class ImageWithOffset
    {
        public Image Image { get; set; }
        public Point Offset { get; set; }
    }

    internal class AddressAndOpacity
    {
        public string Address { get; set; }
        public double Opacity { get; set; }
    }

    ///<inheritdoc />
    public class ImageCreationService : IImageCreationService
    {
        private const int TILE_SIZE = 256; // pixels
        private const int PEN_WIDTH_OFFSET = 8; // pixels
        private const float CIRCLE_RADIUS = 12; // pixels
        private const float PEN_WIDTH = 13; // pixels
        private const float CIRCLE_OUTLINE_WIDTH = 7; // pixels
        private const int MAX_ZOOM = 16;

        private readonly IRemoteFileFetcherGateway _remoteFileFetcherGateway;
        private readonly ILogger _logger;
        private readonly Color[] _routeColors;

        /// <summary>
        /// Contstructor, creates relevant colors and brushes accoridng to configuration
        /// </summary>
        /// <param name="remoteFileFetcherGateway"></param>
        /// <param name="options"></param>
        /// <param name="logger"></param>
        public ImageCreationService(IRemoteFileFetcherGateway remoteFileFetcherGateway, IOptions<ConfigurationData> options, ILogger logger)
        {
            _remoteFileFetcherGateway = remoteFileFetcherGateway;
            _logger = logger;
            _routeColors = options.Value.Colors.Select(c => FromColorString(c)).ToArray();
        }

        ///<inheritdoc />
        public async Task<byte[]> Create(DataContainer dataContainer, int width, int height)
        {
            var context = new ImageCreationContext
            {
                Width = width,
                Height = height,
                DataContainer = dataContainer
            };
            UpdateCorners(context);
            UpdateZoom(context);
            UpdateAddressesTemplates(context);
            await UpdateBackGroundImage(context);
            DrawRoutesOnImage(context);
            CropAndResizeImage(context);
            var imageStream = new MemoryStream();
            context.Image.SaveAsPng(imageStream);
            return imageStream.ToArray();
        }

        /// <summary>
        /// Updates the conrners of the datacontainer to fix the relevant image ratio
        /// It will increase the height or width of the container as needed.
        /// </summary>
        /// <param name="context"></param>
        private void UpdateCorners(ImageCreationContext context)
        {
            if (context.DataContainer.NorthEast == null || context.DataContainer.SouthWest == null)
            {
                var allLocations = context.DataContainer.Routes
                    .SelectMany(r => r.Segments)
                    .SelectMany(s => s.Latlngs)
                    .Concat(context.DataContainer.Routes
                        .SelectMany(r => r.Markers)
                        .Select(m => m.Latlng)
                    )
                    .ToArray();
                context.DataContainer.NorthEast = new LatLng(allLocations.Max(l => l.Lat), allLocations.Max(l => l.Lng));
                context.DataContainer.SouthWest = new LatLng(allLocations.Min(l => l.Lat), allLocations.Min(l => l.Lng));
            }
            var n = Math.Pow(2, MAX_ZOOM);
            var xNorthEast = GetXTile(context.DataContainer.NorthEast.Lng, n);
            var yNorthEast = GetYTile(context.DataContainer.NorthEast.Lat, n);
            var xSouthWest = GetXTile(context.DataContainer.SouthWest.Lng, n);
            var ySouthWest = GetYTile(context.DataContainer.SouthWest.Lat, n);
            var ratio = context.Width * 1.0 / context.Height;
            if (xNorthEast - xSouthWest > ratio * (ySouthWest - yNorthEast))
            {
                var desiredY = (xNorthEast - xSouthWest) / ratio;
                var delatY = (desiredY - (ySouthWest - yNorthEast)) / 2;
                ySouthWest += delatY;
                yNorthEast -= delatY;
            }
            else
            {
                var desiredX = (ySouthWest - yNorthEast) * ratio;
                var delatX = (desiredX - (xNorthEast - xSouthWest)) / 2;
                xNorthEast += delatX;
                xSouthWest -= delatX;
            }

            context.DataContainer.NorthEast.Lng = GetLongitude(xNorthEast, n);
            context.DataContainer.NorthEast.Lat = GetLatitude(yNorthEast, n);
            context.DataContainer.SouthWest.Lng = GetLongitude(xSouthWest, n);
            context.DataContainer.SouthWest.Lat = GetLatitude(ySouthWest, n);
        }

        /// <summary>
        /// Updates the zoom that will have tiles that have more pixels than the image needs
        /// This will make sure the image size will be bigger than the desired image to improve quility
        /// </summary>
        /// <param name="context"></param>
        private void UpdateZoom(ImageCreationContext context)
        {
            var zoom = 0;
            double n;
            double deltaX;
            double deltaY;
            do
            {
                zoom++;
                n = Math.Pow(2, zoom);
                deltaX = GetXTile(context.DataContainer.NorthEast.Lng, n) - GetXTile(context.DataContainer.SouthWest.Lng, n);
                deltaY = GetYTile(context.DataContainer.SouthWest.Lat, n) - GetYTile(context.DataContainer.NorthEast.Lat, n);
                deltaX *= TILE_SIZE;
                deltaY *= TILE_SIZE;
            } while (deltaX < context.Width && deltaY < context.Height);
            context.Zoom = zoom;
            context.N = n;
        }

        /// <summary>
        /// This will update the address templates and remove empty addresses
        /// </summary>
        /// <param name="context"></param>
        private void UpdateAddressesTemplates(ImageCreationContext context)
        {
            var address = IsValidAddress(context.DataContainer.BaseLayer.Address)
                ? context.DataContainer.BaseLayer.Address
                : GetBaseAddressFromInvalidString(context.DataContainer.BaseLayer.Address);

            var addressTemplates = new List<AddressAndOpacity>
            {
                new AddressAndOpacity { Address = FixAdrressTemplate(address), Opacity = context.DataContainer.BaseLayer.Opacity ?? 1.0 }
            };
            foreach (var layerData in context.DataContainer.Overlays ?? new List<LayerData>())
            {
                if (IsValidAddress(layerData.Address) == false)
                {
                    continue;
                }
                var addressAndOpacity = new AddressAndOpacity
                {
                    Address = FixAdrressTemplate(layerData.Address),
                    Opacity = layerData.Opacity ?? 1.0
                };
                addressTemplates.Add(addressAndOpacity);
            }
            context.AddressesTemplates = addressTemplates.ToArray();
        }

        private bool IsValidAddress(string address)
        {
            return !string.IsNullOrWhiteSpace(address) && address.Contains("{x}");
        }

        private string GetBaseAddressFromInvalidString(string address)
        {
            if (string.IsNullOrWhiteSpace(address))
            {
                return "https://israelhiking.osm.org.il/Hebrew/tiles/{z}/{x}/{y}.png";
            }
            if (address.EndsWith(".json") && address.Contains("ilMTB"))
            {
                return "https://israelhiking.osm.org.il/Hebrew/mtbtiles/{z}/{x}/{y}.png";
            }
            return "https://israelhiking.osm.org.il/Hebrew/tiles/{z}/{x}/{y}.png";
        }

        /// <summary>
        /// This will update the backgroud image - which is the image created from the baselayer and the overlay tiles
        /// </summary>
        /// <param name="context"></param>
        /// <returns></returns>
        private async Task UpdateBackGroundImage(ImageCreationContext context)
        {
            var topLeft = new Point((int)GetXTile(context.DataContainer.SouthWest.Lng, context.N), (int)GetYTile(context.DataContainer.NorthEast.Lat, context.N));
            var bottomRight = new Point((int)GetXTile(context.DataContainer.NorthEast.Lng, context.N), (int)GetYTile(context.DataContainer.SouthWest.Lat, context.N));
            context.TopLeft = topLeft;
            context.BottomRight = bottomRight;
            context.Image = await CreateSingleImageFromTiles(context);
        }

        /// <summary>
        /// Will create a single image from all the tiles - this image will include the required image inside
        /// </summary>
        /// <param name="context"></param>
        /// <returns></returns>
        private async Task<Image> CreateSingleImageFromTiles(ImageCreationContext context)
        {
            var horizontalTiles = context.BottomRight.X - context.TopLeft.X + 1;
            var verticalTiles = context.BottomRight.Y - context.TopLeft.Y + 1;
            var tasks = new List<Task<ImageWithOffset>>();
            foreach (var addressTemplate in context.AddressesTemplates)
            {
                for (int x = 0; x < horizontalTiles; x++)
                {
                    for (int y = 0; y < verticalTiles; y++)
                    {
                        var task = GetTileImage(context.TopLeft, new Point(x, y), context.Zoom, addressTemplate);
                        tasks.Add(task);
                    }
                }
            }

            var imagesWithOffsets = await Task.WhenAll(tasks);
            var image = new Image<Rgba32>(horizontalTiles * TILE_SIZE, verticalTiles * TILE_SIZE);
            foreach (var imageWithOffset in imagesWithOffsets)
            {
                image.Mutate(x => x.DrawImage(imageWithOffset.Image,
                    new Point(imageWithOffset.Offset.X * TILE_SIZE, imageWithOffset.Offset.Y * TILE_SIZE), 
                    1.0f));
            }
            return image;
        }

        private static string FixAdrressTemplate(string addressTemplate)
        {
            addressTemplate = addressTemplate.Trim();
            var lowerAddress = addressTemplate.ToLower();
            if (lowerAddress.StartsWith("http") == false && lowerAddress.StartsWith("www") == false)
            {
                return "https://israelhiking.osm.org.il" + lowerAddress;
            }
            return addressTemplate;
        }

        /// <summary>
        /// This will draw on the backgroup image the route and markers according to color and opacity
        /// </summary>
        /// <param name="context"></param>
        private void DrawRoutesOnImage(ImageCreationContext context)
        {
            context.Image.Mutate(ctx =>
            {
                var routeColorIndex = 0;
                foreach (var route in context.DataContainer.Routes)
                {
                    var points = route.Segments.SelectMany(s => s.Latlngs).Select(l => ConvertLatLngToPoint(l, context)).ToArray();
                    var markerPoints = route.Markers.Select(m => ConvertLatLngToPoint(m.Latlng, context));
                    var lineColor = _routeColors[routeColorIndex++];
                    routeColorIndex = routeColorIndex % _routeColors.Length;
                    if (!string.IsNullOrEmpty(route.Color))
                    {
                        lineColor = FromColorString(route.Color, route.Opacity);
                    }

                    if (points.Any())
                    {
                        var path = new SixLabors.Shapes.Path(new LinearLineSegment(points));
                        ctx.Draw(Color.White, PEN_WIDTH + PEN_WIDTH_OFFSET, path);
                        ctx.Draw(lineColor, PEN_WIDTH, path);
                        var startCircle = new EllipsePolygon(points.First(), CIRCLE_RADIUS);
                        ctx.Fill(Color.White, startCircle);
                        ctx.Draw(Color.Green, CIRCLE_OUTLINE_WIDTH, startCircle);
                        var endCircle = new EllipsePolygon(points.Last(), CIRCLE_RADIUS);
                        ctx.Fill(Color.White, endCircle);
                        ctx.Draw(Color.Red, CIRCLE_OUTLINE_WIDTH, endCircle);
                    }
        
                    foreach (var markerPoint in markerPoints)
                    {
                        var markerEllipse = new EllipsePolygon(markerPoint, CIRCLE_RADIUS);
                        ctx.Fill(Color.White, markerEllipse);
                        ctx.Draw(lineColor, PEN_WIDTH, markerEllipse);
                    }
                }
            });
        }

        #region Coordinates Conversion
        private double GetXTile(double longitude, double n)
        {
            return n * ((longitude + 180.0) / 360.0);
        }

        private double GetYTile(double latitude, double n)
        {
            var latitudeInRadians = latitude * Math.PI / 180.0;
            return (n / 2) * (1 - Math.Log(Math.Tan(latitudeInRadians) + 1.0 / Math.Cos(latitudeInRadians)) / Math.PI);
        }

        private double GetLongitude(double xTile, double n)
        {
            return xTile / n * 360.0 - 180.0;
        }

        private double GetLatitude(double yTile, double n)
        {
            var latitudeInRadians = Math.Atan(Math.Sinh(Math.PI * (1 - 2 * yTile / n)));
            return latitudeInRadians * 180.0 / Math.PI;
        }
        #endregion

        /// <summary>
        /// This method will fetch the relevant image
        /// If the required zoom is too big it will fetch and image from a lower zoom and split the relevant part of it
        /// This allow the other parts of the algorithm to be ignorat to the max zoom .
        /// </summary>
        /// <param name="topLeft">Top left corner</param>
        /// <param name="offset">Offset from corner</param>
        /// <param name="zoom">required zoom level</param>
        /// <param name="addressTemplate">The address template to fetch the file from</param>
        /// <returns></returns>
        private async Task<ImageWithOffset> GetTileImage(Point topLeft, Point offset, int zoom, AddressAndOpacity addressTemplate)
        {
            var xY = new Point(topLeft.X + offset.X, topLeft.Y + offset.Y);
            var translatedXy = xY;
            var zoomDifference = Math.Pow(2, zoom - MAX_ZOOM);
            if (zoomDifference > 1)
            {
                // zoom is above max native zoom
                zoom = MAX_ZOOM;
                translatedXy = new Point
                {
                    X = (int)(xY.X / zoomDifference),
                    Y = (int)(xY.Y / zoomDifference),
                };
            }
            var file = addressTemplate.Address.Replace("{z}", "{zoom}")
                        .Replace("{zoom}", zoom.ToString())
                        .Replace("{x}", translatedXy.X.ToString())
                        .Replace("{y}", translatedXy.Y.ToString());
            var fileResponse = await _remoteFileFetcherGateway.GetFileContent(file);
            if (!fileResponse.Content.Any())
            {
                return new ImageWithOffset
                {
                    Image = new Image<Rgba32>(TILE_SIZE, TILE_SIZE),
                    Offset = offset
                };
            }
            var image = Image.Load(fileResponse.Content);
            if (addressTemplate.Opacity < 1.0)
            {
                image.Mutate(x => x.Opacity((float)addressTemplate.Opacity));
            }
            if (zoomDifference > 1)
            {
                MagnifyImagePart(image, zoomDifference, xY, translatedXy);
            }
            return new ImageWithOffset
            {
                Image = image,
                Offset = offset
            };
        }

        /// <summary>
        /// Allows conversion between the image pixels and wgs84 coordinates
        /// </summary>
        /// <param name="latLng"></param>
        /// <param name="context"></param>
        /// <returns></returns>
        private PointF ConvertLatLngToPoint(LatLng latLng, ImageCreationContext context)
        {
            var x = (float)((GetXTile(latLng.Lng, context.N) - context.TopLeft.X) * TILE_SIZE);
            var y = (float)((GetYTile(latLng.Lat, context.N) - context.TopLeft.Y) * TILE_SIZE);
            return new PointF(x, y);
        }

        /// <summary>
        /// Utility method to overcome .net core issues with color.
        /// </summary>
        /// <param name="colorString"></param>
        /// <param name="opacity"></param>
        /// <returns></returns>
        private Color FromColorString(string colorString, double? opacity = null)
        {
            Color color = Color.Blue;
            if (colorString.StartsWith("#"))
            {
                color = Color.FromHex(colorString);
            } 
            else
            {
                foreach (var currentColor in Color.WebSafePalette.ToArray())
                {
                    if (currentColor.ToString().Equals(colorString, StringComparison.InvariantCultureIgnoreCase))
                    {
                        color = currentColor;
                        break;
                    }
                }

            }
            if (color.ToPixel<Rgba32>().A == 255 && opacity.HasValue)
            {
                var pixelColor = color.ToPixel<Rgba32>();
                color = Color.FromRgba(pixelColor.R, pixelColor.G, pixelColor.B, (byte)(opacity * 255));
            }
            return color;
        }

        /// <summary>
        /// This takes the relevant image part and convert it to a full size tile
        /// </summary>
        /// <param name="image"></param>
        /// <param name="zoomDifference"></param>
        /// <param name="xY"></param>
        /// <param name="translatedXy"></param>
        /// <returns></returns>
        private void MagnifyImagePart(Image image, double zoomDifference, Point xY, Point translatedXy)
        {
            var x = xY.X / zoomDifference - translatedXy.X;
            var y = xY.Y / zoomDifference - translatedXy.Y;
            image.Mutate(ctx => ctx.Crop(new Rectangle((int)(x * image.Width), (int)(y * image.Height), (int)(image.Width / zoomDifference), (int)(image.Height / zoomDifference)))
                .Resize(TILE_SIZE, TILE_SIZE)
            );
        }

        /// <summary>
        /// Crop and resizes the image to the desired dimentions
        /// </summary>
        /// <param name="context"></param>
        private void CropAndResizeImage(ImageCreationContext context)
        {
            var topLeft = ConvertLatLngToPoint(context.DataContainer.SouthWest, context);
            var bottomRight = ConvertLatLngToPoint(context.DataContainer.NorthEast, context);
            context.Image.Mutate(x =>
                x.Crop(new Rectangle((int)topLeft.X, (int)bottomRight.Y, (int)(bottomRight.X - topLeft.X), (int)(topLeft.Y - bottomRight.Y)))
                .Resize(context.Width, context.Height)
            );
        }
    }
}
