using System;
using System.Collections.Generic;
using System.IO;
using System.Net.Http;
using IsraelHiking.API.Controllers;
using IsraelHiking.DataAccessInterfaces;
using Microsoft.VisualStudio.TestTools.UnitTesting;
using NSubstitute;

namespace IsraelHiking.API.Tests.Controllers
{
    [TestClass]
    public class FileExplorerControllerTests
    {
        private FileExplorerController _controller;
        private IFileSystemHelper _fileSystemHelper;
        private const string EXAMPLE_DIRECTORY = @"C:\Exmple";

        [TestInitialize]
        public void TestInitialize()
        {
            _fileSystemHelper = Substitute.For<IFileSystemHelper>();
            var configurationManager = Substitute.For<IConfigurationProvider>();
            configurationManager.ListingDictionary.Returns(new Dictionary<string, string> { { "example", EXAMPLE_DIRECTORY } });
            _controller = new FileExplorerController(_fileSystemHelper, configurationManager);
        }

        [TestMethod]
        public void GetListingPage_RequestPathNotInConfig_ShouldReturnEmptyTable()
        {
            _controller.Request = new HttpRequestMessage {  RequestUri = new Uri("http://www.www.com/") };

            var response = _controller.GetListingPage("path");

            var stringContent = response.Content as StringContent;
            Assert.IsNotNull(stringContent);
            Assert.IsFalse(stringContent.ReadAsStringAsync().Result.Contains("class='fa"));
        }

        [TestMethod]
        public void GetListingPage_Null_ShouldReturnBaseFolderListing()
        {
            var path = "path";
            var dir1 = "dir1";
            _controller.Request = new HttpRequestMessage { RequestUri = new Uri("http://www.www.com/Example") };
            _fileSystemHelper.Exists(Arg.Is<string>(x => x.Contains(EXAMPLE_DIRECTORY))).Returns(true);
            _fileSystemHelper.GetNonHiddenDirectories(Path.Combine(EXAMPLE_DIRECTORY, path)).Returns(new[] { dir1 });
            _fileSystemHelper.GetShortName(dir1).Returns(dir1);

            var response = _controller.GetListingPage(null);

            var stringContent = response.Content as StringContent;
            Assert.IsNotNull(stringContent);
            Assert.IsFalse(stringContent.ReadAsStringAsync().Result.Contains("class='fa"));
        }

        [TestMethod]
        public void GetListingPage_PathWithoutSlashAtTheEnd_ShouldReturnDirectories()
        {
            var path = "path";
            var dir1 = "dir1";
            _controller.Request = new HttpRequestMessage { RequestUri = new Uri("http://www.www.com/Example") };
            _fileSystemHelper.Exists(Arg.Is<string>(x => x.Contains(EXAMPLE_DIRECTORY))).Returns(true);
            _fileSystemHelper.GetNonHiddenDirectories(Path.Combine(EXAMPLE_DIRECTORY, path)).Returns(new[] { dir1 });
            _fileSystemHelper.GetShortName(dir1).Returns(dir1);

            var response = _controller.GetListingPage(path);

            var stringContent = response.Content as StringContent;
            Assert.IsNotNull(stringContent);
            Assert.IsTrue(stringContent.ReadAsStringAsync().Result.Contains("fa-folder"));
        }

        [TestMethod]
        public void GetListingPage_PysicalPathDoesNotExists_ShouldReturnEmptyListing()
        {
            var path = "path";
            _controller.Request = new HttpRequestMessage { RequestUri = new Uri("http://www.www.com/Example") };
            _fileSystemHelper.Exists(EXAMPLE_DIRECTORY).Returns(true);

            var response = _controller.GetListingPage(path);

            var stringContent = response.Content as StringContent;
            Assert.IsNotNull(stringContent);
            var html = stringContent.ReadAsStringAsync().Result;
            Assert.IsFalse(html.Contains("class='fa-folder"));
            Assert.IsTrue(html.Contains("Invalid Folder"));
        }

        [TestMethod]
        public void GetListingPage_ForDeeperPath_ShouldReturnFiles()
        {
            var path = "path";
            var filesList = new[] {"zipfile.zip", "image.png", "xml.xml", "text.txt"};
            _controller.Request = new HttpRequestMessage { RequestUri = new Uri("http://www.www.com/Example/path/path") };
            _fileSystemHelper.Exists(Arg.Is<string>(x => x.Contains(EXAMPLE_DIRECTORY))).Returns(true);
            _fileSystemHelper.GetNonHiddenFiles(Path.Combine(EXAMPLE_DIRECTORY, path)).Returns(filesList);
            _fileSystemHelper.GetShortName(Arg.Any<string>()).Returns(x => x[0]);
            for (int index = 0; index < filesList.Length; index++)
            {
                _fileSystemHelper.GetSize(filesList[index]).Returns((int)Math.Pow(1024, index) + 1);
            }

            var response = _controller.GetListingPage(path);

            var stringContent = response.Content as StringContent;
            Assert.IsNotNull(stringContent);
            var html = stringContent.ReadAsStringAsync().Result;
            Assert.IsTrue(html.Contains("fa-file-zip"));
            Assert.IsTrue(html.Contains("fa-file-code"));
            Assert.IsTrue(html.Contains("fa-file-image"));
            Assert.IsTrue(html.Contains("fa-file-text"));
            Assert.IsTrue(html.Contains("Gb"));
            Assert.IsTrue(html.Contains("Mb"));
            Assert.IsTrue(html.Contains("Kb"));
            Assert.IsTrue(html.Contains(" b"));
        }
    }
}
