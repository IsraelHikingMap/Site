using System.Collections.Generic;
using System.Drawing;
using System.Drawing.Imaging;
using System.IO;
using System.Linq;
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
                .Returns(new RemoteFileFetcherGatewayResponse
                {
                    FileName = "file.png",
                    Content = stream.ToArray()
                });
        }

        private DataContainer GetDataContainer(List<LatLng> latLngs)
        {
            return new DataContainer
            {
                BaseLayer = new LayerData(),
                Routes = new List<RouteData>
                {
                    new RouteData
                    {
                        Segments = new List<RouteSegmentData>
                        {
                            new RouteSegmentData
                            {
                                Latlngs = latLngs
                            }
                        },
                        Markers = new List<MarkerData>
                        {
                            new MarkerData {Latlng = latLngs.FirstOrDefault() }
                        }
                    }
                }
            };
        }

        [TestMethod]
        public void Zoom16_RouteInSingleTile_ShouldResizeSingleTile4Times()
        {
            var dataContainer = GetDataContainer(new List<LatLng>
            {
                new LatLng {Lat = 0.0001, Lng = 0.0001},
                new LatLng {Lat = 0.0002, Lng = 0.0002}
            });

            var ressults = _imageCreationService.Create(dataContainer).Result;

            Assert.IsTrue(ressults.Length > 0);
            _remoteFileFetcherGateway.Received(2).GetFileContent(Arg.Any<string>());
        }

        [TestMethod]
        public void Zoom16_RouteInSingleTileTileIsMissing_ShouldUseEmptyBitmaps()
        {
            var dataContainer = GetDataContainer(new List<LatLng>
            {
                new LatLng {Lat = 0.0001, Lng = 0.0001},
                new LatLng {Lat = 0.0002, Lng = 0.0002}
            });
            _remoteFileFetcherGateway.GetFileContent(Arg.Any<string>())
                .Returns(new RemoteFileFetcherGatewayResponse
                {
                    FileName = "missing.png",
                    Content = new byte[0]
                });

            var ressults = _imageCreationService.Create(dataContainer).Result;

            Assert.IsTrue(ressults.Length > 0);
            _remoteFileFetcherGateway.Received(2).GetFileContent(Arg.Any<string>());
        }

        [TestMethod]
        public void Zoom16_RouteInTwoHorizontalTile_ShouldResize4Tile2Times()
        {
            var dataContainer = GetDataContainer(new List<LatLng>
            {
                new LatLng {Lat = 0.01, Lng = 0.01},
                new LatLng {Lat = 0.01, Lng = 0.015}
            });

            var ressults = _imageCreationService.Create(dataContainer).Result;

            Assert.IsTrue(ressults.Length > 0);
            _remoteFileFetcherGateway.Received(2).GetFileContent(Arg.Any<string>());
        }

        [TestMethod]
        public void Zoom16_RouteInTwoVerticalTile_ShouldResize4Tile2Times()
        {
            var dataContainer = GetDataContainer(new List<LatLng>
            {
                new LatLng {Lat = 0.01, Lng = 0.01},
                new LatLng {Lat = 0.015, Lng = 0.01}
            });

            var ressults = _imageCreationService.Create(dataContainer).Result;

            Assert.IsTrue(ressults.Length > 0);
            _remoteFileFetcherGateway.Received(8).GetFileContent(Arg.Any<string>());
        }

        [TestMethod]
        public void Zoom13_RouteInSingleTile_ShouldMergeZoom15Tiles()
        {
            var dataContainer = GetDataContainer(new List<LatLng>
            {
                new LatLng {Lat = 0.1, Lng = 0.1},
                new LatLng {Lat = 0.15, Lng = 0.15}
            });

            var ressults = _imageCreationService.Create(dataContainer).Result;

            Assert.IsTrue(ressults.Length > 0);
            _remoteFileFetcherGateway.Received(8).GetFileContent(Arg.Any<string>());
        }

        [TestMethod]
        public void Zoom13_RouteIsNarrowHorizontalLine_ShouldMergeZoom15Tiles()
        {
            var dataContainer = GetDataContainer(new List<LatLng>
            {
                new LatLng {Lat = 0.1, Lng = 0.1},
                new LatLng {Lat = 0.1, Lng = 0.15}
            });

            var ressults = _imageCreationService.Create(dataContainer).Result;

            Assert.IsTrue(ressults.Length > 0);
            _remoteFileFetcherGateway.Received(8).GetFileContent(Arg.Any<string>());
        }

        [TestMethod]
        public void Zoom13_RouteIsNarrowVerticalLine_ShouldMergeZoom15Tiles()
        {
            var dataContainer = GetDataContainer(new List<LatLng>
            {
                new LatLng {Lat = 0.1, Lng = 0.1},
                new LatLng {Lat = 0.15, Lng = 0.1}
            });

            var ressults = _imageCreationService.Create(dataContainer).Result;

            Assert.IsTrue(ressults.Length > 0);
            _remoteFileFetcherGateway.Received(8).GetFileContent(Arg.Any<string>());
        }

        [TestMethod]
        public void Zoom13_RouteIsNarrowVerticalLineWithOverlay_ShouldFetchOverlayTiles()
        {
            var dataContainer = GetDataContainer(new List<LatLng>
            {
                new LatLng {Lat = 0.1, Lng = 0.1},
                new LatLng {Lat = 0.15, Lng = 0.1}
            });
            dataContainer.Overlays = new List<LayerData>{ new LayerData { Address = "overlay" } };

            var ressults = _imageCreationService.Create(dataContainer).Result;

            Assert.IsTrue(ressults.Length > 0);
            _remoteFileFetcherGateway.Received(16).GetFileContent(Arg.Any<string>());
        }

        [TestMethod]
        public void LocalTiles_RouteWithNoPoints_ShouldReturnBackgroungImageFromBounds()
        {
            var dataContainer = new DataContainer
            {
                NorthEast = new LatLng { Lat = 0.1, Lng = 0.1 },
                SouthWest = new LatLng { Lat = 0.15, Lng = 0.15 },
                BaseLayer = new LayerData { Address = "/Tiles/{z}/{x}/{y}.png"},
                Routes = new List<RouteData> {  new RouteData() }
            };

            var ressults = _imageCreationService.Create(dataContainer).Result;

            Assert.IsTrue(ressults.Length > 0);
            _remoteFileFetcherGateway.Received(8).GetFileContent(Arg.Any<string>());
        }
    }
}
