using System.Collections.Generic;
using IsraelHiking.API.Controllers;
using IsraelHiking.Common;
using IsraelHiking.DataAccessInterfaces;
using Microsoft.AspNetCore.Mvc;
using Microsoft.VisualStudio.TestTools.UnitTesting;
using NSubstitute;

namespace IsraelHiking.API.Tests.Controllers
{
    [TestClass]
    public class UserLayersControllerTests
    {
        private IRepository _repository;
        private UserLayersController _controller;
        
        [TestInitialize]
        public void TestInitialize()
        {
            _repository = Substitute.For<IRepository>();
            _controller = new UserLayersController(_repository);
        }

        [TestCleanup]
        public void TestCleanup()
        {
            _controller.Dispose();
        }

        [TestMethod]
        public void GetLayers_ShouldGetThem()
        {
            var userLayers = new UserMapLayers {Layers = new List<MapLayerData> {new MapLayerData()}};
            var osmUser = "osmUser";
            _controller.SetupIdentity(osmUser);
            _repository.GetUserLayers(osmUser).Returns(userLayers);
            
            var result = _controller.GetUserLayers().Result as OkObjectResult;
            
            Assert.IsNotNull(result);
            var returnedUserLayers = result.Value as UserMapLayers;
            Assert.IsNotNull(returnedUserLayers);
            Assert.AreEqual(returnedUserLayers.Layers.Count, userLayers.Layers.Count);
        }

        [TestMethod]
        public void PostUserLayers_EmptyUser_ShouldReturnUnauthorized()
        {
            var results = _controller.PostUserLayers(string.Empty, null).Result;
            
            Assert.IsNotNull(results as BadRequestResult);
        }

        [TestMethod]
        public void PostUserLayers_UnauthorizedUser_ShouldReturnUnauthorized()
        {
            _controller.SetupIdentity("123");
            var results = _controller.PostUserLayers("456", null).Result;

            Assert.IsNotNull(results as BadRequestResult);
        }

        [TestMethod]
        public void PostUserLayers_AuthorizedUser_ShouldUpdateUserLayers()
        {
            var osmUserId = "osmUserId";
            _controller.SetupIdentity(osmUserId);

            var results = _controller.PostUserLayers(osmUserId, new UserMapLayers()).Result;

            Assert.IsNotNull(results as OkObjectResult);
            _repository.Received(1).UpdateUserLayers(osmUserId, Arg.Any<UserMapLayers>());
        }
    }
}
