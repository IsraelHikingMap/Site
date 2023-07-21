using System;
using System.Collections.Generic;
using IsraelHiking.API.Controllers;
using IsraelHiking.API.Services;
using IsraelHiking.Common;
using IsraelHiking.Common.Configuration;
using IsraelHiking.DataAccessInterfaces.Repositories;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Options;
using Microsoft.VisualStudio.TestTools.UnitTesting;
using NSubstitute;
using OsmSharp.API;
using OsmSharp.IO.API;
using System.IO;
using System.Text;
using IsraelHiking.Common.DataContainer;
using IsraelHiking.Common.Extensions;
using IsraelHiking.DataAccessInterfaces;
using Microsoft.Extensions.Caching.Distributed;
using NetTopologySuite.Features;
using NetTopologySuite.Geometries;
using ILogger = Microsoft.Extensions.Logging.ILogger;

namespace IsraelHiking.API.Tests.Controllers
{
    [TestClass]
    public class OsmTracesControllerTests 
    {
        private OsmTracesController _controller;
        private IClientsFactory _clientsFactory;
        private IDataContainerConverterService _dataContainerConverterService;
        private IImageCreationGateway _imageCreationGateway;
        private ISearchRepository _searchRepository;
        private IDistributedCache _distributedCache;
        
        [TestInitialize]
        public void TestInitialize()
        {
            _clientsFactory = Substitute.For<IClientsFactory>();
            _dataContainerConverterService = Substitute.For<IDataContainerConverterService>();
            _imageCreationGateway = Substitute.For<IImageCreationGateway>();
            _searchRepository = Substitute.For<ISearchRepository>();
            _distributedCache = Substitute.For<IDistributedCache>();
            var options = new ConfigurationData();
            var optionsProvider = Substitute.For<IOptions<ConfigurationData>>();
            optionsProvider.Value.Returns(options);
            _controller = new OsmTracesController(_clientsFactory, _dataContainerConverterService, _imageCreationGateway, _searchRepository, _distributedCache, optionsProvider, Substitute.For<ILogger>());
        }

        [TestMethod]
        public void GetTraces_ShouldGetThemFromOsm()
        {
            _controller.SetupIdentity();
            var osmGateWay = SetupOAuthClient();
            _controller.Url = Substitute.For<IUrlHelper>();
            osmGateWay.GetTraces().Returns(new[] {new GpxFile
            {
                Id = 42,
                Description = "description",
                Name = "name",
                Tags = Array.Empty<string>()
            }});

        _controller.GetTraces().Wait();

            osmGateWay.Received(1).GetTraces();
        }

        [TestMethod]
        public void GetTraceById_ShouldGetIt()
        {
            _controller.SetupIdentity();
            var osmGateWay = SetupOAuthClient();
            osmGateWay.GetTraceData(42).Returns(new TypedStream {Stream = new MemoryStream()});
            _dataContainerConverterService.ToDataContainer(Arg.Any<byte[]>(), Arg.Any<string>())
                .Returns(new DataContainerPoco());
            
            var results = _controller.GetTraceById(42).Result;
            
            Assert.IsNotNull(results);
        }

        [TestMethod]
        public void GetTraceByIdImage_ShouldGetIt()
        {
            _controller.SetupIdentity();
            var osmGateWay = SetupOAuthClient();
            osmGateWay.GetTraceData(42).Returns(new TypedStream {Stream = new MemoryStream()});
            _dataContainerConverterService.ToDataContainer(Arg.Any<byte[]>(), Arg.Any<string>())
                .Returns(new DataContainerPoco());
            _imageCreationGateway.Create(Arg.Any<DataContainerPoco>(), Arg.Any<int>(), Arg.Any<int>())
                .Returns(new byte[] {1});
            
            var results = _controller.GetTraceByIdImage(42).Result as FileContentResult;
            
            Assert.IsNotNull(results);
        }
        
        [TestMethod]
        public void PostUploadGpsTrace_NoFile_ShouldReturnBadRequest()
        {
            var results = _controller.PostUploadGpsTrace(null).Result as BadRequestResult;

            Assert.IsNotNull(results);
        }

        [TestMethod]
        public void PostUploadGpsTrace_UploadFileWhenAlreadyInCache_ShouldReturnOK()
        {
            var file = Substitute.For<IFormFile>();
            file.FileName.Returns("SomeFile.gpx");
            var osmGateWay = SetupOAuthClient();
            _distributedCache.Get(Arg.Any<string>()).Returns(Encoding.UTF8.GetBytes("something"));
            _controller.SetupIdentity();
        
            var response = _controller.PostUploadGpsTrace(file).Result;

            Assert.IsNotNull(response as OkResult);
        }
        
        [TestMethod]
        public void PostUploadGpsTrace_UploadFile_ShouldSendItToOsmGateway()
        {
            var file = Substitute.For<IFormFile>();
            file.FileName.Returns("SomeFile.gpx");
            var osmGateWay = SetupOAuthClient();

            _controller.SetupIdentity();
        
            _controller.PostUploadGpsTrace(file).Wait();

            osmGateWay.Received(1).CreateTrace(Arg.Any<GpxFile>(), Arg.Any<MemoryStream>());
        }

        [TestMethod]
        public void PostUploadRouteData_NotEnoughPoint_ShouldReturnBadRequest()
        {
            var result = _controller.PostUploadRouteData(new RouteData(), Languages.HEBREW).Result as BadRequestObjectResult;
            
            Assert.IsNotNull(result);
        }

        [TestMethod]
        public void PostUploadRouteData_DefaultName_ShouldCreateTraceAndUpdateDescriptionToMatchArea()
        {
            _controller.SetupIdentity();
            var osmGateWay = SetupOAuthClient();
            var routeData = new RouteData
            {
                Id = "42",
                Name = "Route",
                Description = "Route",
                Segments = new List<RouteSegmentData>
                {
                    new()
                    {
                        Latlngs = new List<LatLngTime>
                        {
                            new(0, 0),
                            new(1, 1),
                            new(2, 2)
                        }
                    }
                }
            };
            var containingFeature = new Feature(new Polygon(new LinearRing(new[]
            {
                new Coordinate(-1, -1),
                new Coordinate(-1, 3),
                new Coordinate(3, 3),
                new Coordinate(3, -1),
                new Coordinate(-1, -1)
            })), new AttributesTable
            {
                {FeatureAttributes.NAME, "name"},
                {FeatureAttributes.ID, "42"},
                {FeatureAttributes.POI_ID, "42"}
            });
            containingFeature.SetTitles();
            _searchRepository.GetContainers(Arg.Any<Coordinate>()).Returns(new List<IFeature> {containingFeature});
            _distributedCache.Get(Arg.Any<string>()).Returns((byte[])null);
            
            _controller.PostUploadRouteData(routeData, Languages.ENGLISH).Wait();

            osmGateWay.Received(1).CreateTrace(Arg.Is<GpxFile>(f => f.Description.Contains("A route in")), Arg.Any<Stream>());
        }
        
        [TestMethod]
        public void PostUploadRouteData_RecordedUsingName_ShouldCreateTraceAndUpdateDescriptionToMatchArea()
        {
            _controller.SetupIdentity();
            var osmGateWay = SetupOAuthClient();
            var routeData = new RouteData
            {
                Id = "42",
                Name = "Recorded using IHM at 2000-01-01",
                Segments = new List<RouteSegmentData>
                {
                    new()
                    {
                        Latlngs = new List<LatLngTime>
                        {
                            new(0, 0),
                            new(1, 1),
                            new(2, 2)
                        }
                    }
                }
            };
            var containingFeature = new Feature(new Polygon(new LinearRing(new[]
            {
                new Coordinate(-1, -1),
                new Coordinate(-1, 3),
                new Coordinate(3, 3),
                new Coordinate(3, -1),
                new Coordinate(-1, -1)
            })), new AttributesTable
            {
                {FeatureAttributes.NAME, "area"},
                {FeatureAttributes.ID, "42"},
                {FeatureAttributes.POI_ID, "42"}
            });
            containingFeature.SetTitles();
            _searchRepository.GetContainers(Arg.Any<Coordinate>()).Returns(new List<IFeature> {containingFeature});
            _distributedCache.Get(Arg.Any<string>()).Returns((byte[])null);
            
            _controller.PostUploadRouteData(routeData, Languages.ENGLISH).Wait();

            osmGateWay.Received(1).CreateTrace(Arg.Is<GpxFile>(f => f.Description.Contains("A route in area") && f.Name.Contains("Recorded using IHM")), Arg.Any<Stream>());
        }

        [TestMethod]
        public void PutGpsTrace_ShouldUpdate()
        {
            _controller.SetupIdentity();
            var osmGateWay = SetupOAuthClient();

            _controller.PutGpsTrace("42", new Trace { Id = "42", Visibility = "public" }).Wait();

            osmGateWay.Received(1).UpdateTrace(Arg.Any<GpxFile>());
        }

        [TestMethod]
        public void PutGpsTrace_WrongId_ShouldNotUpdate()
        {
            _controller.SetupIdentity();
            var osmGateWay = SetupOAuthClient();

            _controller.PutGpsTrace("7", new Trace { Id = "42", Visibility = "public" }).Wait();

            osmGateWay.Received(0).UpdateTrace(Arg.Any<GpxFile>());
        }

        [TestMethod]
        public void DeleteGpsTrace_ShouldDeleteIt()
        {
            long id = 1;
            _controller.SetupIdentity();
            var osmGateWay = SetupOAuthClient();

            _controller.DeleteGpsTrace(id).Wait();

            osmGateWay.Received(1).DeleteTrace(id);
        }

        private IAuthClient SetupOAuthClient()
        {
            var osmGateWay = Substitute.For<IAuthClient>();
            _clientsFactory.CreateOAuthClient(Arg.Any<string>(), Arg.Any<string>(), Arg.Any<string>(), Arg.Any<string>()).Returns(osmGateWay);
            return osmGateWay;
        }
    }
}
