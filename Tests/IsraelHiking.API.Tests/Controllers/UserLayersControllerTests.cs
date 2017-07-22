using System.Collections.Generic;
using System.Security.Claims;
using IsraelHiking.API.Controllers;
using IsraelHiking.Common;
using IsraelHiking.DataAccessInterfaces;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.VisualStudio.TestTools.UnitTesting;
using NSubstitute;

namespace IsraelHiking.API.Tests.Controllers
{
    [TestClass]
    public class UserLayersControllerTests
    {
        private IIsraelHikingRepository _israelHikingRepository;
        private UserLayersController _controller;
        
        [TestInitialize]
        public void TestInitialize()
        {
            _israelHikingRepository = Substitute.For<IIsraelHikingRepository>();
            _controller = new UserLayersController(_israelHikingRepository);
        }

        [TestCleanup]
        public void TestCleanup()
        {
            _controller.Dispose();
        }
        
        private void SetupIdentity(string osmUserId = "42")
        {
            var user = new ClaimsPrincipal(new ClaimsIdentity(new [] {
                new Claim(ClaimTypes.Name, osmUserId)
            }));
            _controller.ControllerContext = new ControllerContext
            {
                HttpContext = new DefaultHttpContext { User = user }
            };
        }

        [TestMethod]
        public void GetLayers_ShouldGetThem()
        {
            var userLayers = new UserLayers {Layers = new List<UserLayerData> {new UserLayerData()}};
            var osmUser = "osmUser";
            SetupIdentity(osmUser);
            _israelHikingRepository.GetUserLayers(osmUser).Returns(userLayers);
            
            var result = _controller.GetUserLayers().Result as OkObjectResult;
            
            Assert.IsNotNull(result);
            var returnedUserLayers = result.Value as UserLayers;
            Assert.IsNotNull(returnedUserLayers);
            Assert.AreEqual(returnedUserLayers.Layers.Count, userLayers.Layers.Count);
        }

        [TestMethod]
        public void PostUserLayers_EmptyUser_ShouldReturnUnauthorized()
        {
            var results = _controller.PostUserLayers(string.Empty, null).Result;
            
            Assert.IsNotNull(results as UnauthorizedResult);
        }

        [TestMethod]
        public void PostUserLayers_UnauthorizedUser_ShouldReturnUnauthorized()
        {
            SetupIdentity("123");
            var results = _controller.PostUserLayers("456", null).Result;

            Assert.IsNotNull(results as UnauthorizedResult);
        }

        [TestMethod]
        public void PostUserLayers_AuthorizedUser_ShouldUpdateUserLayers()
        {
            var osmUserId = "osmUserId";
            SetupIdentity(osmUserId);

            var results = _controller.PostUserLayers(osmUserId, new UserLayers()).Result;

            Assert.IsNotNull(results as OkObjectResult);
            _israelHikingRepository.Received(1).UpdateUserLayers(osmUserId, Arg.Any<UserLayers>());
        }
    }
}
