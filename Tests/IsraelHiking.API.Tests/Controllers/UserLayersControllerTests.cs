using IsraelHiking.API.Controllers;
using IsraelHiking.Common;
using IsraelHiking.DataAccessInterfaces.Repositories;
using Microsoft.AspNetCore.Mvc;
using Microsoft.VisualStudio.TestTools.UnitTesting;
using NSubstitute;
using System.Collections.Generic;

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

        [TestMethod]
        public void GetLayers_ShouldGetThem()
        {
            var layers = new List<MapLayerData> {new MapLayerData()};
            var osmUser = "osmUser";
            _controller.SetupIdentity(null, osmUser);
            _repository.GetUserLayers(osmUser).Returns(layers);
            
            var result = _controller.GetUserLayers().Result as OkObjectResult;
            
            Assert.IsNotNull(result);
            var returnedUserLayers = result.Value as List<MapLayerData>;
            Assert.IsNotNull(returnedUserLayers);
            Assert.AreEqual(layers.Count, returnedUserLayers.Count);
        }

        [TestMethod]
        public void PostUserLayer_EmptyKey_ShouldReturnBadRequest()
        {
            var results = _controller.PostUserLayer(new MapLayerData()).Result;

            Assert.IsNotNull(results as BadRequestObjectResult);
        }

        [TestMethod]
        public void PostUserLayer_EmptyAddress_ShouldReturnBadRequest()
        {
            var results = _controller.PostUserLayer(new MapLayerData { Key = "key"}).Result;

            Assert.IsNotNull(results as BadRequestObjectResult);
        }

        [TestMethod]
        public void PostUserLayer_AuthorizedUser_ShouldUpdateUserLayers()
        {
            var id = "id";
            var osmUserId = "osmUserId";
            var layer = new MapLayerData {Key = "key", Address = "address"};
            _controller.SetupIdentity(null, osmUserId);
            _repository.AddUserLayer(layer).Returns(layer).AndDoes(l => (l[0] as MapLayerData).Id = id);

            var results = _controller.PostUserLayer(layer).Result as OkObjectResult;

            Assert.IsNotNull(results);
            Assert.AreEqual(id, (results.Value as MapLayerData).Id);
        }

        [TestMethod]
        public void PutUserLayer_InvalidId_ShouldReturnBadRequest()
        {
            var id = "id";
            var layer = new MapLayerData { Key = "key", Address = "address", Id = id};

            var results = _controller.PutUserLayer("42", layer).Result as BadRequestObjectResult;

            Assert.IsNotNull(results);
        }

        [TestMethod]
        public void PutUserLayer_InvalidUser_ShouldReturnBadRequest()
        {
            var id = "id";
            _controller.SetupIdentity();
            var layer = new MapLayerData { Key = "key", Address = "address", Id = id, OsmUserId = "123"};

            var results = _controller.PutUserLayer(id, layer).Result as BadRequestObjectResult;

            Assert.IsNotNull(results);
        }

        [TestMethod]
        public void PutUserLayer_InvalidLayer_ShouldReturnBadRequest()
        {
            var id = "id";
            var osmUserId = "osmUserId";
            _controller.SetupIdentity(null, osmUserId);
            var layer = new MapLayerData { Id = id, OsmUserId = osmUserId };

            var results = _controller.PutUserLayer(id, layer).Result as BadRequestObjectResult;

            Assert.IsNotNull(results);
        }

        [TestMethod]
        public void PutUserLayer_LayerDoesNotBelongToUser_ShouldReturnBadRequest()
        {
            var id = "id";
            var osmUserId = "osmUserId";
            _controller.SetupIdentity(null, osmUserId);
            _repository.GetUserLayers(osmUserId).Returns(new List<MapLayerData>());
            var layer = new MapLayerData { Key = "key", Address = "address", Id = id, OsmUserId = osmUserId };

            var results = _controller.PutUserLayer(id, layer).Result as BadRequestObjectResult;

            Assert.IsNotNull(results);
        }

        [TestMethod]
        public void PutUserLayer_ValidRequest_ShouldUpdateRepository()
        {
            var id = "id";
            var osmUserId = "osmUserId";
            var layer = new MapLayerData { Key = "key", Address = "address", Id = id, OsmUserId = osmUserId };
            _controller.SetupIdentity(null, osmUserId);
            _repository.GetUserLayers(osmUserId).Returns(new List<MapLayerData> { layer });
            

            var results = _controller.PutUserLayer(id, layer).Result as OkObjectResult;

            Assert.IsNotNull(results);
            _repository.Received(1).UpdateUserLayer(layer);
        }

        [TestMethod]
        public void DeleteUserLayer_LayerNotInRepository_ShouldReturnNotFound()
        {
            var id = "id";
            _repository.GetUserLayerById(id).Returns(null as MapLayerData);

            var results = _controller.DeleteUserLayer(id).Result as NotFoundResult;

            Assert.IsNotNull(results);
        }

        [TestMethod]
        public void DeleteUserLayer_InvalidRequest_ShouldReturnBadRequest()
        {
            var id = "id";
            var osmUserId = "osmUserId";
            var layer = new MapLayerData { Id = id, OsmUserId = osmUserId };
            _controller.SetupIdentity(null, osmUserId);
            _repository.GetUserLayerById(id).Returns(layer);
            _repository.GetUserLayers(osmUserId).Returns(new List<MapLayerData> { layer });

            var results = _controller.DeleteUserLayer(id).Result as BadRequestObjectResult;

            Assert.IsNotNull(results);
        }

        [TestMethod]
        public void DeleteUserLayer_ValidRequest_ShouldDeleteFromRepository()
        {
            var id = "id";
            var osmUserId = "osmUserId";
            var layer = new MapLayerData { Key = "key", Address = "address", Id = id, OsmUserId = osmUserId };
            _controller.SetupIdentity(null, osmUserId);
            _repository.GetUserLayerById(id).Returns(layer);
            _repository.GetUserLayers(osmUserId).Returns(new List<MapLayerData> { layer });

            var results = _controller.DeleteUserLayer(id).Result as OkObjectResult;

            Assert.IsNotNull(results);
            _repository.Received(1).DeleteUserLayer(layer);
        }
    }
}
