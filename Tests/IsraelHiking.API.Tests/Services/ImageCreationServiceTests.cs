using System.Collections.Generic;
using System.Drawing;
using System.Drawing.Imaging;
using System.IO;
using System.Threading.Tasks;
using IsraelHiking.API.Services;
using IsraelHiking.Common;
using IsraelHiking.DataAccessInterfaces;
using Microsoft.VisualStudio.TestTools.UnitTesting;
using NSubstitute;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace IsraelHiking.API.Tests.Services
{
    [TestClass]
    public class ImageCreationServiceTests
    {
        private ImageCreationService _imageCreationService;
        private IRemoteFileFetcherGateway _remoteFileFetcherGateway;

        [TestInitialize]
        public void TestInitialize()
        {
            _remoteFileFetcherGateway = Substitute.For<IRemoteFileFetcherGateway>();
            var factory = Substitute.For<IHttpGatewayFactory>();
            factory.CreateRemoteFileFetcherGateway(Arg.Any<TokenAndSecret>()).Returns(_remoteFileFetcherGateway);
            var options = Substitute.For<IOptions<ConfigurationData>>();
            options.Value.Returns(new ConfigurationData());
            _imageCreationService = new ImageCreationService(factory, options, Substitute.For<ILogger>());
            SetupRemoteFileFetcherWithBlankTile();
        }

        private void SetupRemoteFileFetcherWithBlankTile()
        {
            var bitmap = new Bitmap(256, 256);
            var stream = new MemoryStream();
            bitmap.Save(stream, ImageFormat.Png);
            _remoteFileFetcherGateway.GetFileContent(Arg.Any<string>())
                .Returns(
                    Task.FromResult(new RemoteFileFetcherGatewayResponse
                    {
                        FileName = "file.png",
                        Content = stream.ToArray()
                    }));
        }

        private DataContainer GetDataContainer(List<LatLngZ> latLngZs)
        {
            return new DataContainer
            {
                baseLayer = new LayerData(),
                routes = new List<RouteData>
                {
                    new RouteData
                    {
                        segments = new List<RouteSegmentData>
                        {
                            new RouteSegmentData
                            {
                                latlngzs = latLngZs
                            }
                        }
                    }
                }
            };
        }

        [TestMethod]
        public void Zoom16_RouteInSingleTile_ShouldResizeSingleTile4Times()
        {
            var dataContainer = GetDataContainer(new List<LatLngZ>
            {
                new LatLngZ {lat = 0.0001, lng = 0.0001},
                new LatLngZ {lat = 0.0002, lng = 0.0002}
            });

            var ressults = _imageCreationService.Create(dataContainer).Result;

            Assert.IsTrue(ressults.Length > 0);
            _remoteFileFetcherGateway.Received(2).GetFileContent(Arg.Any<string>());
        }

        [TestMethod]
        public void Zoom16_RouteInSingleTileTileIsMissing_ShouldUseEmptyBitmaps()
        {
            var dataContainer = GetDataContainer(new List<LatLngZ>
            {
                new LatLngZ {lat = 0.0001, lng = 0.0001},
                new LatLngZ {lat = 0.0002, lng = 0.0002}
            });
            _remoteFileFetcherGateway.GetFileContent(Arg.Any<string>())
                .Returns(
                    Task.FromResult(new RemoteFileFetcherGatewayResponse
                    {
                        FileName = "missing.png",
                        Content = new byte[0]
                    }));

            var ressults = _imageCreationService.Create(dataContainer).Result;

            Assert.IsTrue(ressults.Length > 0);
            _remoteFileFetcherGateway.Received(2).GetFileContent(Arg.Any<string>());
        }

        [TestMethod]
        public void Zoom16_RouteInTwoHorizontalTile_ShouldResize4Tile2Times()
        {
            var dataContainer = GetDataContainer(new List<LatLngZ>
            {
                new LatLngZ {lat = 0.01, lng = 0.01},
                new LatLngZ {lat = 0.01, lng = 0.015}
            });

            var ressults = _imageCreationService.Create(dataContainer).Result;

            Assert.IsTrue(ressults.Length > 0);
            _remoteFileFetcherGateway.Received(2).GetFileContent(Arg.Any<string>());
        }

        [TestMethod]
        public void Zoom16_RouteInTwoVerticalTile_ShouldResize4Tile2Times()
        {
            var dataContainer = GetDataContainer(new List<LatLngZ>
            {
                new LatLngZ {lat = 0.01, lng = 0.01},
                new LatLngZ {lat = 0.015, lng = 0.01}
            });

            var ressults = _imageCreationService.Create(dataContainer).Result;

            Assert.IsTrue(ressults.Length > 0);
            _remoteFileFetcherGateway.Received(8).GetFileContent(Arg.Any<string>());
        }

        [TestMethod]
        public void Zoom13_RouteInSingleTile_ShouldMergeZoom15Tiles()
        {
            var dataContainer = GetDataContainer(new List<LatLngZ>
            {
                new LatLngZ {lat = 0.1, lng = 0.1},
                new LatLngZ {lat = 0.15, lng = 0.15}
            });

            var ressults = _imageCreationService.Create(dataContainer).Result;

            Assert.IsTrue(ressults.Length > 0);
            _remoteFileFetcherGateway.Received(8).GetFileContent(Arg.Any<string>());
        }

        [TestMethod]
        public void Zoom13_RouteIsNarrowHorizontalLine_ShouldMergeZoom15Tiles()
        {
            var dataContainer = GetDataContainer(new List<LatLngZ>
            {
                new LatLngZ {lat = 0.1, lng = 0.1},
                new LatLngZ {lat = 0.1, lng = 0.15}
            });

            var ressults = _imageCreationService.Create(dataContainer).Result;

            Assert.IsTrue(ressults.Length > 0);
            _remoteFileFetcherGateway.Received(8).GetFileContent(Arg.Any<string>());
        }

        [TestMethod]
        public void Zoom13_RouteIsNarrowVerticalLine_ShouldMergeZoom15Tiles()
        {
            var dataContainer = GetDataContainer(new List<LatLngZ>
            {
                new LatLngZ {lat = 0.1, lng = 0.1},
                new LatLngZ {lat = 0.15, lng = 0.1}
            });

            var ressults = _imageCreationService.Create(dataContainer).Result;

            Assert.IsTrue(ressults.Length > 0);
            _remoteFileFetcherGateway.Received(8).GetFileContent(Arg.Any<string>());
        }

        [TestMethod]
        public void LocalTiles_RouteWithNoPoints_ShouldReturnBackgroungImageFromBounds()
        {
            var dataContainer = new DataContainer
            {
                northEast = new LatLng { lat = 0.1, lng = 0.1 },
                southWest = new LatLng { lat = 0.15, lng = 0.15 },
                baseLayer = new LayerData { address = "/Tiles/{z}/{x}/{y}.png"},
                routes = new List<RouteData> {  new RouteData() }
            };

            var ressults = _imageCreationService.Create(dataContainer).Result;

            Assert.IsTrue(ressults.Length > 0);
            _remoteFileFetcherGateway.Received(8).GetFileContent(Arg.Any<string>());
        }
    }
}
