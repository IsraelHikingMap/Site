using System;
using System.Collections.Generic;
using System.Linq;
using IsraelHiking.API.Controllers;
using IsraelHiking.API.Executors;
using IsraelHiking.API.Services.Poi;
using Microsoft.AspNetCore.Mvc;
using Microsoft.VisualStudio.TestTools.UnitTesting;
using NSubstitute;

namespace IsraelHiking.API.Tests.Controllers
{
    [TestClass]
    public class ExternalSourcesControllerTests
    {
        private ExternalSourcesController _controller;
        private IPointsOfInterestAdapterFactory _pointsOfInterestAdapterFactory;
        private IExternalSourceUpdaterExecutor _externalSourceUpdaterExecutor;
        
        [TestInitialize]
        public void TestInitialize()
        {
            _pointsOfInterestAdapterFactory = Substitute.For<IPointsOfInterestAdapterFactory>();
            _externalSourceUpdaterExecutor = Substitute.For<IExternalSourceUpdaterExecutor>();
            _controller =
                new ExternalSourcesController(_pointsOfInterestAdapterFactory, _externalSourceUpdaterExecutor);
        }

        [TestMethod]
        public void GetSources_ShouldGetThem()
        {
            _pointsOfInterestAdapterFactory.GetAll().Returns(new List<IPointsOfInterestAdapter>());
            
            var sources = _controller.GetSources();
            
            Assert.AreEqual(0, sources.Count());
        }
        
        [TestMethod]
        public void PostRebuildSource_InvalidSource_ShouldReturnNotFound()
        {
            _pointsOfInterestAdapterFactory.GetAll().Returns(new List<IPointsOfInterestAdapter>());
            
            var results = _controller.PostRebuildSource("source").Result as NotFoundObjectResult;
            
            Assert.IsNotNull(results);
        }

        [TestMethod]
        public void PostRebuildSource_ValidSource_ShouldRebuild()
        {
            const string sourceName = "Source";
            var source = Substitute.For<IPointsOfInterestAdapter>();
            source.Source.Returns(sourceName);
            _pointsOfInterestAdapterFactory.GetAll().Returns(new List<IPointsOfInterestAdapter> {source});

            var results = _controller.PostRebuildSource(sourceName).Result as OkResult;
            
            Assert.IsNotNull(results);
            _externalSourceUpdaterExecutor.Received(1).RebuildSource(sourceName);
        }
        
        [TestMethod]
        public void PutUpdateSource_InvalidSource_ShouldReturnNotFound()
        {
            _pointsOfInterestAdapterFactory.GetAll().Returns(new List<IPointsOfInterestAdapter>());
            
            var results = _controller.PutUpdateSource("source").Result as NotFoundObjectResult;
            
            Assert.IsNotNull(results);
        }

        [TestMethod]
        public void PutUpdateSource_ValidSource_ShouldRebuild()
        {
            const string sourceName = "Source";
            var source = Substitute.For<IPointsOfInterestAdapter>();
            source.Source.Returns(sourceName);
            _pointsOfInterestAdapterFactory.GetAll().Returns(new List<IPointsOfInterestAdapter> {source});

            var results = _controller.PutUpdateSource(sourceName).Result as OkResult;
            
            Assert.IsNotNull(results);
            _externalSourceUpdaterExecutor.Received(1).UpdateSource(sourceName);
        }
    }
}