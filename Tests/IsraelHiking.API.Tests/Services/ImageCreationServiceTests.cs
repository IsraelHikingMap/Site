using IsraelHiking.API.Services;
using IsraelHiking.Common;
using IsraelHiking.Common.Api;
using IsraelHiking.Common.Configuration;
using IsraelHiking.Common.DataContainer;
using IsraelHiking.DataAccessInterfaces;
using Microsoft.Extensions.Options;
using Microsoft.VisualStudio.TestTools.UnitTesting;
using NSubstitute;
using SixLabors.ImageSharp;
using SixLabors.ImageSharp.PixelFormats;
using System.Collections.Generic;
using System.IO;
using System.Linq;

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
            var options = Substitute.For<IOptions<ConfigurationData>>();
            options.Value.Returns(new ConfigurationData());
            _imageCreationService = new ImageCreationService(_remoteFileFetcherGateway, options);
            SetupRemoteFileFetcherWithBlankTile();
        }

        private void SetupRemoteFileFetcherWithBlankTile()
        {
            var bitmap = new Image<Rgba32>(256, 256);
            var stream = new MemoryStream();
            bitmap.SaveAsPng(stream);
            _remoteFileFetcherGateway.GetFileContent(Arg.Any<string>())
                .Returns(new RemoteFileFetcherGatewayResponse
                {
                    FileName = "file.png",
                    Content = stream.ToArray()
                });
        }

        private DataContainerPoco GetDataContainer(List<LatLngTime> latLngs)
        {
            return new DataContainerPoco
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
        public void Zoom16_RouteInSingleTile_ShouldResizeSingleTile6Times()
        {
            var dataContainer = GetDataContainer(new List<LatLngTime>
            {
                new LatLngTime {Lat = 0.0001, Lng = 0.0001},
                new LatLngTime {Lat = 0.0002, Lng = 0.0002}
            });

            var ressults = _imageCreationService.Create(dataContainer, 512, 256).Result;

            Assert.IsTrue(ressults.Length > 0);
            _remoteFileFetcherGateway.Received(6).GetFileContent(Arg.Any<string>());
        }

        [TestMethod]
        public void Zoom16_RouteInSingleTileTileIsMissing_ShouldUseEmptyBitmaps()
        {
            var dataContainer = GetDataContainer(new List<LatLngTime>
            {
                new LatLngTime {Lat = 0.0001, Lng = 0.0001},
                new LatLngTime {Lat = 0.0002, Lng = 0.0002}
            });
            _remoteFileFetcherGateway.GetFileContent(Arg.Any<string>())
                .Returns(new RemoteFileFetcherGatewayResponse
                {
                    FileName = "missing.png",
                    Content = new byte[0]
                });

            var ressults = _imageCreationService.Create(dataContainer, 600, 255).Result;

            Assert.IsTrue(ressults.Length > 0);
            _remoteFileFetcherGateway.Received(8).GetFileContent(Arg.Any<string>());
        }

        [TestMethod]
        public void Zoom16_RouteInTwoHorizontalTiles_ShouldResize4Tile3Times()
        {
            var dataContainer = GetDataContainer(new List<LatLngTime>
            {
                new LatLngTime {Lat = 0.01, Lng = 0.01},
                new LatLngTime {Lat = 0.01, Lng = 0.015}
            });

            var ressults = _imageCreationService.Create(dataContainer, 512, 256).Result;

            Assert.IsTrue(ressults.Length > 0);
            _remoteFileFetcherGateway.Received(12).GetFileContent(Arg.Any<string>());
        }

        [TestMethod]
        public void Zoom16_RouteInTwoVerticalTile_ShouldResize5Tile3Times()
        {
            var dataContainer = GetDataContainer(new List<LatLngTime>
            {
                new LatLngTime {Lat = 0.01, Lng = 0.01},
                new LatLngTime {Lat = 0.015, Lng = 0.01}
            });

            var ressults = _imageCreationService.Create(dataContainer, 512, 256).Result;

            Assert.IsTrue(ressults.Length > 0);
            _remoteFileFetcherGateway.Received(15).GetFileContent(Arg.Any<string>());
        }

        [TestMethod]
        public void Zoom13_RouteInSingleTile_UseZoom13Tiles()
        {
            var dataContainer = GetDataContainer(new List<LatLngTime>
            {
                new LatLngTime {Lat = 0.1, Lng = 0.1},
                new LatLngTime {Lat = 0.15, Lng = 0.15}
            });

            var ressults = _imageCreationService.Create(dataContainer, 600, 255).Result;

            Assert.IsTrue(ressults.Length > 0);
            _remoteFileFetcherGateway.Received(8).GetFileContent(Arg.Is<string>(x => x.Contains("/13/")));
        }

        [TestMethod]
        public void Zoom13_RouteIsNarrowHorizontalLine_UseZoom14Tiles()
        {
            var dataContainer = GetDataContainer(new List<LatLngTime>
            {
                new LatLngTime {Lat = 0.1, Lng = 0.1},
                new LatLngTime {Lat = 0.1, Lng = 0.15}
            });

            var ressults = _imageCreationService.Create(dataContainer, 512, 256).Result;

            Assert.IsTrue(ressults.Length > 0);
            _remoteFileFetcherGateway.Received(9).GetFileContent(Arg.Is<string>(x => x.Contains("/14/")));
        }

        [TestMethod]
        public void Zoom13_RouteIsNarrowVerticalLine_ShouldUseZoom13Tiles()
        {
            var dataContainer = GetDataContainer(new List<LatLngTime>
            {
                new LatLngTime {Lat = 0.1, Lng = 0.1},
                new LatLngTime {Lat = 0.15, Lng = 0.1}
            });

            var ressults = _imageCreationService.Create(dataContainer, 600, 255).Result;

            Assert.IsTrue(ressults.Length > 0);
            _remoteFileFetcherGateway.Received(8).GetFileContent(Arg.Is<string>(x => x.Contains("/13/")));
        }

        [TestMethod]
        public void Zoom13_RouteIsNarrowVerticalLineWithOverlay_ShouldFetchOverlayTiles()
        {
            var dataContainer = GetDataContainer(new List<LatLngTime>
            {
                new LatLngTime {Lat = 0.1, Lng = 0.1},
                new LatLngTime {Lat = 0.15, Lng = 0.1}
            });
            dataContainer.Overlays = new List<LayerData>{ new LayerData { Address = "http://www.overlay.com/{z}/{y}/{x}" } };

            var ressults = _imageCreationService.Create(dataContainer, 600, 255).Result;

            Assert.IsTrue(ressults.Length > 0);
            _remoteFileFetcherGateway.Received(16).GetFileContent(Arg.Any<string>());
        }

        [TestMethod]
        public void Zoom13_OverlayIsNotInAValidFormat_ShouldFetchOnlyBaseLayer()
        {
            var dataContainer = GetDataContainer(new List<LatLngTime>
            {
                new LatLngTime {Lat = 0.1, Lng = 0.1},
                new LatLngTime {Lat = 0.15, Lng = 0.1}
            });
            dataContainer.Overlays = new List<LayerData> { new LayerData { Address = "overlay" } };

            var ressults = _imageCreationService.Create(dataContainer, 600, 255).Result;

            Assert.IsTrue(ressults.Length > 0);
            _remoteFileFetcherGateway.Received(8).GetFileContent(Arg.Any<string>());
        }

        [TestMethod]
        public void LocalTiles_RouteWithNoPoints_ShouldReturnBackgroungImageFromBounds()
        {
            var dataContainer = new DataContainerPoco
            {
                NorthEast = new LatLng { Lat = 0.15, Lng = 0.15 },
                SouthWest = new LatLng { Lat = 0.1, Lng = 0.1 },
                BaseLayer = new LayerData { Address = "/Tiles/{z}/{x}/{y}.png"},
                Routes = new List<RouteData> {  new RouteData() }
            };

            var ressults = _imageCreationService.Create(dataContainer, 600, 255).Result;

            Assert.IsTrue(ressults.Length > 0);
            _remoteFileFetcherGateway.Received(8).GetFileContent(Arg.Any<string>());
        }

        [TestMethod]
        public void LocalTiles_RouteColorAndOpacity_ShouldDrawAccordingly()
        {
            var dataContainer = new DataContainerPoco
            {
                BaseLayer = new LayerData { Address = "/Tiles/{z}/{x}/{y}.png" },
                Overlays = new List<LayerData>
                {
                    new LayerData(), // should be ignored
                    new LayerData { Address = "www.address.com/{z}/{y}/{x}.png", Opacity = 0.5 }
                },
                Routes = new List<RouteData> { new RouteData
                {
                    Color = "red",
                    Opacity = 0.5,
                    Segments = new List<RouteSegmentData>
                    {
                        new RouteSegmentData {Latlngs = new List<LatLngTime>
                        {
                            new LatLngTime { Lat = 0.15, Lng = 0.15 },
                            new LatLngTime { Lat = 0.1, Lng = 0.1 }
                        }}
                    }
                } }
            };

            var ressults = _imageCreationService.Create(dataContainer, 600, 255).Result;

            Assert.IsTrue(ressults.Length > 0);
            _remoteFileFetcherGateway.Received(16).GetFileContent(Arg.Any<string>());
        }
    }
}
