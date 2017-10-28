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
    public class RatingControllerTests
    {
        private IRepository _repository;
        private RatingController _controller;

        [TestInitialize]
        public void TestInitialize()
        {
            _repository = Substitute.For<IElasticSearchGateway>();
            _controller = new RatingController(_repository);
        }

        [TestMethod]
        public void GetRating_EmptyId_ShouldReturnBadRequest()
        {
            var result = _controller.GetRating(null, null).Result as BadRequestObjectResult;

            Assert.IsNotNull(result);
        }

        [TestMethod]
        public void GetRating_EmptySource_ShouldReturnBadRequest()
        {
            var result = _controller.GetRating("42", null).Result as BadRequestObjectResult;

            Assert.IsNotNull(result);
        }

        [TestMethod]
        public void GetRating_ValidInput_ShouldReturnRating()
        {
            var id = "42";
            var source = "source";
            var result = _controller.GetRating(id, source).Result as OkObjectResult;

            Assert.IsNotNull(result);
            _repository.Received(1).GetRating(id, source);
        }

        [TestMethod]
        public void UploadRating_EmptyId_ShouldReturnBadRequest()
        {
            var resutls = _controller.UploadRating(new Rating {Id = "  "}).Result as BadRequestObjectResult;
            
            Assert.IsNotNull(resutls);
        }

        [TestMethod]
        public void UploadRating_EmptySource_ShouldReturnBadRequest()
        {
            var resutls = _controller.UploadRating(new Rating { Id = "42", Source = ""}).Result as BadRequestObjectResult;

            Assert.IsNotNull(resutls);
        }

        [TestMethod]
        public void UploadRating_InvalidUser_ShouldReturnBadRequest()
        {
            _controller.SetupIdentity();

            var resutls = _controller.UploadRating(new Rating { Id = "-1", Source = "source", Raters = new List<Rater> { new Rater { Id = "invalidUser" }}}).Result as BadRequestObjectResult;

            Assert.IsNotNull(resutls);
        }

        [TestMethod]
        public void UploadRating_AddNewRating_ShouldReturnNewRating()
        {
            var poiId = "poiId";
            var osmUserId = "42";
            var source = "source";
            _controller.SetupIdentity(osmUserId);
            _repository.GetRating(poiId, source).Returns(new Rating {Raters = new List<Rater>()});
            var resutls = _controller.UploadRating(new Rating { Id = poiId, Source = source, Raters = new List<Rater> { new Rater { Id = osmUserId, Value = 1}}}).Result as OkObjectResult;

            Assert.IsNotNull(resutls);
            var returnedRating = resutls.Value as Rating;
            Assert.IsNotNull(returnedRating);
            Assert.AreEqual(1, returnedRating.Raters.Count);
            _repository.Received(1).UpdateRating(Arg.Any<Rating>());
        }

        [TestMethod]
        public void UploadRating_UpdateRating_ShouldReturnUpdatedRating()
        {
            var poiId = "poiId";
            var osmUserId = "42";
            var source = "source";
            _controller.SetupIdentity(osmUserId);
            _repository.GetRating(poiId, source).Returns(new Rating {Raters = new List<Rater> {new Rater {Id = osmUserId, Value = -1}}});
            var resutls = _controller.UploadRating(new Rating { Id = poiId, Source = source, Raters = new List<Rater> { new Rater { Id = osmUserId, Value = 1 } } }).Result as OkObjectResult;

            Assert.IsNotNull(resutls);
            var returnedRating = resutls.Value as Rating;
            Assert.IsNotNull(returnedRating);
            Assert.AreEqual(1, returnedRating.Raters.Count);
            _repository.Received(1).UpdateRating(Arg.Any<Rating>());
        }
    }
}
