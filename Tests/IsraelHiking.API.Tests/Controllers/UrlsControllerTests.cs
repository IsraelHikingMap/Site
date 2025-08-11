using IsraelHiking.API.Controllers;
using IsraelHiking.API.Converters;
using IsraelHiking.API.Services;
using IsraelHiking.Common;
using IsraelHiking.Common.DataContainer;
using IsraelHiking.DataAccessInterfaces;
using IsraelHiking.DataAccessInterfaces.Repositories;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Logging;
using Microsoft.VisualStudio.TestTools.UnitTesting;
using NSubstitute;
using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Threading.Tasks;

namespace IsraelHiking.API.Tests.Controllers;

[TestClass]
public class UrlsControllerTests
{
    private UrlsController _controller;
    private IShareUrlsRepository _repository;
    private IDataContainerConverterService _containerConverterService;
    private IImgurGateway _imgurGateway;
    private IImageCreationGateway _imageCreationGateway;

    [TestInitialize]
    public void TestInitialize()
    {
        _repository = Substitute.For<IShareUrlsRepository>();
        _containerConverterService = Substitute.For<IDataContainerConverterService>();
        _imgurGateway = Substitute.For<IImgurGateway>();
        _imageCreationGateway = Substitute.For<IImageCreationGateway>();
        _controller = new UrlsController(_repository, _containerConverterService, new Base64ImageStringToFileConverter(), _imgurGateway, _imageCreationGateway, Substitute.For<ILogger>());
    }

    [TestMethod]
    public void GetShareUrl_ItemNotInDatabase_ShouldReturnBadRequest()
    {
        var results = _controller.GetShareUrl("42").Result as BadRequestResult;

        Assert.IsNotNull(results);
    }

    [TestMethod]
    public void GetShareUrl_ItemInDatabase_ShouldReturnIt()
    {
        var id = "someId";
        _repository.GetUrlById(id).Returns(new ShareUrl { Id = id });

        var results = _controller.GetShareUrl(id).Result as OkObjectResult;

        Assert.IsNotNull(results);
        var content = results.Value as ShareUrl;
        Assert.IsNotNull(results);
        Assert.IsNotNull(content);
        Assert.AreEqual(id, content.Id);
    }

    [TestMethod]
    public void GetShareUrl_ItemInDatabase_ShouldReturnItAccordingToFromat()
    {
        var id = "someId";
        var bytes = new byte[] { 1 };
        _repository.GetUrlById(id).Returns(new ShareUrl { Id = id, DataContainer = new DataContainerPoco() });
        _containerConverterService.ToAnyFormat(Arg.Any<DataContainerPoco>(), "gpx").Returns(bytes);

        var results = _controller.GetShareUrl(id, "gpx").Result as FileContentResult;

        Assert.IsNotNull(results);
        var content = results.FileContents;
        Assert.IsNotNull(content);
        Assert.AreEqual(bytes.Length, content.Length);
    }

    [TestMethod]
    public void GetShareUrlForUser_ItemInDatabase_ShouldReturnShortedByCreationDate()
    {
        var id = "someId";
        var list = new List<ShareUrl>
        {
            new ShareUrl { OsmUserId = id, CreationDate = DateTime.Now.AddDays(-1)},
            new ShareUrl { OsmUserId = id, CreationDate = DateTime.Now.AddDays(-2)},
            new ShareUrl { OsmUserId = id, CreationDate = DateTime.Now}
        };
        _controller.SetupIdentity(id);
        _repository.GetUrlsByUser(id).Returns(list);

        var results = _controller.GetShareUrlForUser().Result as OkObjectResult;

        Assert.IsNotNull(results);
        Assert.IsNotNull(results.Value as IEnumerable<ShareUrl>);
        Assert.AreEqual(list.Count, ((IEnumerable<ShareUrl>)results.Value).Count());
        Assert.AreEqual(list.OrderByDescending(d => d.CreationDate).First().CreationDate, ((IEnumerable<ShareUrl>)results.Value).First().CreationDate);
    }

    [TestMethod]
    public void GetShareUrlLastModifiedTimeStamp_ShouldReturnLastModifiedTimeStamp()
    {
        var id = "someId";
        var date = DateTime.Now.AddDays(-1);
        _repository.GetUrlTimestampById(id).Returns(date);
        
        var results = _controller.GetShareUrlLastModifiedTimeStamp(id).Result;
        
        Assert.AreEqual(results, date);
    }
    
    [TestMethod]
    public void GetImageForShare_NoUrl_ShouldNotFound()
    {
        var results = _controller.GetImageForShare("42").Result as NotFoundResult;

        Assert.IsNotNull(results);
    }

    [TestMethod]
    public void GetImageForShare_UrlInDatabase_ShouldCreateIt()
    {
        var siteUrl = new ShareUrl
        {
            Id = "1",
            DataContainer = new DataContainerPoco()
        };
        _repository.GetUrlById(siteUrl.Id).Returns(siteUrl);

        var results = _controller.GetImageForShare(siteUrl.Id).Result as FileContentResult;

        Assert.IsNotNull(results);
        _imageCreationGateway.Received(1).Create(Arg.Any<DataContainerPoco>(), 600, 315);
    }
    
    [TestMethod]
    public void GetImageForShare_ImageInDatabase_ShouldReturnIt()
    {
        var siteUrl = new ShareUrl
        {
            Id = "1",
            Base64Preview = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAUAAAAFCAYAAACNbyblAAAAHElEQVQI12P4//8/w38GIAXDIBKE0DHxgljNBAAO9TXL0Y4OHwAAAABJRU5ErkJggg=="
        };
        _repository.GetUrlById(siteUrl.Id).Returns(siteUrl);

        var results = _controller.GetImageForShare(siteUrl.Id).Result as FileContentResult;

        Assert.IsNotNull(results);
    }
    
    [TestMethod]
    public void PostShareUrl_NullShare_ShouldReturnBadRequest()
    {
        var results = _controller.PostShareUrl(null).Result as BadRequestObjectResult;

        Assert.IsNotNull(results);
    }
        
    [TestMethod]
    public void PostShareUrl_IncorrectUser_ShouldReturnBadRequest()
    {
        var url = new ShareUrl { OsmUserId = "1" };
        _controller.SetupIdentity("2");

        var results = _controller.PostShareUrl(url).Result as BadRequestObjectResult;

        Assert.IsNotNull(results);
    }

    [TestMethod]
    public void PostShareUrl_RandomHitsItemInDatabase_ShouldAddShareUrl()
    {
        // first fetch from repository returns an item while the second one doesn't
        _repository.GetUrlById(Arg.Any<string>())
            .Returns(_ => new ShareUrl(), _ => null);

        var results = _controller.PostShareUrl(new ShareUrl()).Result as OkObjectResult;

        Assert.IsNotNull(results);
        var content = results.Value as ShareUrl;
        Assert.IsNotNull(results);
        Assert.IsNotNull(content);
        Assert.AreEqual(10, content.Id.Length);
    }

    [TestMethod]
    public void PostShareUrl_WithImageDataUrl_ShouldAddShareUrlUploadToImgurAndUpdateIt()
    {
        // first fetch from repository returns an item while the second one doesn't
        _repository.GetUrlById(Arg.Any<string>())
            .Returns(_ => new ShareUrl(), _ => null);
        const string url = "url";
        var task = Task.Run(() => url);
        _imgurGateway.UploadImage(Arg.Any<Stream>()).Returns(task);

        var shareUrl = new ShareUrl
        {
            DataContainer = new DataContainerPoco
            {
                Routes =
                [
                    new RouteData
                    {
                        Markers =
                        [
                            new MarkerData
                            {
                                Urls =
                                [
                                    new LinkData
                                    {
                                        Url =
                                            "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAUAAAAFCAYAAACNbyblAAAAHElEQVQI12P4//" +
                                            "8/w38GIAXDIBKE0DHxgljNBAAO9TXL0Y4OHwAAAABJRU5ErkJggg=="
                                    }
                                ]
                            }
                        ]
                    }
                ]
            }
        };

        var results = _controller.PostShareUrl(shareUrl).Result as OkObjectResult;

        Assert.IsNotNull(results);
        var content = results.Value as ShareUrl;
        Assert.IsNotNull(results);
        Assert.IsNotNull(content);
        Assert.AreEqual(10, content.Id.Length);
        task.Wait();
        Task.Delay(100).Wait(); // just to make sure the ContinueWith finishes to run... not a great workaround...
        _repository.Received(1).Update(Arg.Is<ShareUrl>(x => x.DataContainer.Routes.First().Markers.First().Urls.First().Url == url));
    }

    [TestMethod]
    public void PutShareUrl_ItemNotInDatabase_ShouldReturnBadRequest()
    {
        var shareUrl = new ShareUrl { Id = "42", OsmUserId = "42" };
        _repository.GetUrlById(shareUrl.Id).Returns((ShareUrl)null);

        var results = _controller.PutShareUrl(shareUrl.Id, shareUrl).Result as NotFoundResult;

        Assert.IsNotNull(results);
        _repository.DidNotReceive().Update(Arg.Any<ShareUrl>());
    }

    [TestMethod]
    public void PutShareUrl_ItemDoesNotBelongToUSer_ShouldReturnBadRequest()
    {
        var shareUrl = new ShareUrl { Id = "42", OsmUserId = "42" };
        _repository.GetUrlById(shareUrl.Id).Returns(shareUrl);
        _controller.SetupIdentity("1");

        var results = _controller.PutShareUrl(shareUrl.Id, shareUrl).Result as BadRequestObjectResult;

        Assert.IsNotNull(results);
        _repository.DidNotReceive().Update(Arg.Any<ShareUrl>());
    }

    [TestMethod]
    public void PutShareUrl_ItemBelongsToUser_ShouldUpdateIt()
    {
        var shareUrl = new ShareUrl { Id = "1", OsmUserId = "1" };
        _repository.GetUrlById(shareUrl.Id).Returns(shareUrl);
        _controller.SetupIdentity(shareUrl.OsmUserId);

        var results = _controller.PutShareUrl(shareUrl.Id, shareUrl).Result as OkObjectResult;

        Assert.IsNotNull(results);
        _repository.Received(1).Update(Arg.Is<ShareUrl>(s => s.DataContainer == null && s.Base64Preview == null));
    }
    
    [TestMethod]
    public void PutShareUrl_WithNewImageAndDataContainer_ShouldUpdateIt()
    {
        var shareUrlFromDb = new ShareUrl { Id = "1", OsmUserId = "1" };
        _repository.GetUrlById(shareUrlFromDb.Id).Returns(shareUrlFromDb);
        _controller.SetupIdentity(shareUrlFromDb.OsmUserId);

        var updatedShareUrl = new ShareUrl { Id = shareUrlFromDb.Id, OsmUserId = shareUrlFromDb.OsmUserId, DataContainer = new DataContainerPoco(), Base64Preview = "image" };
        
        var results = _controller.PutShareUrl(updatedShareUrl.Id, updatedShareUrl).Result as OkObjectResult;

        Assert.IsNotNull(results);
        _repository.Received(1).Update(Arg.Is<ShareUrl>(s => s.DataContainer != null && s.Base64Preview == updatedShareUrl.Base64Preview));
    }

    [TestMethod]
    public void DeleteShareUrl_ItemNotInDatabase_ShouldReturnNotFound()
    {
        var id = "42";
        _repository.GetUrlById(id).Returns(null as ShareUrl);

        var result = _controller.DeleteShareUrl(id).Result as NotFoundResult;

        Assert.IsNotNull(result);
    }

    [TestMethod]
    public void DeleteShareUrl_ItemUserIdDoesNotMatchUSer_ShouldReturnBadRequest()
    {
        _controller.SetupIdentity("1");
        var shareUrl = new ShareUrl { Id = "11", OsmUserId = "11" };
        _repository.GetUrlById(shareUrl.Id).Returns(shareUrl);

        var result = _controller.DeleteShareUrl(shareUrl.Id).Result as BadRequestObjectResult;

        Assert.IsNotNull(result);
    }


    [TestMethod]
    public void DeleteShareUrl_ItemInDatabase_ShouldRemoveIt()
    {
        var shareUrl = new ShareUrl { Id = "42", OsmUserId = "42" };
        _repository.GetUrlById(shareUrl.Id).Returns(shareUrl);
        _controller.SetupIdentity(shareUrl.OsmUserId);

        _controller.DeleteShareUrl(shareUrl.Id).Wait();

        _repository.Received(1).Delete(shareUrl);
    }
}