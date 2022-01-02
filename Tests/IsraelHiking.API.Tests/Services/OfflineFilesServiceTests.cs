using System;
using System.Collections.Generic;
using IsraelHiking.API.Services;
using IsraelHiking.Common.Configuration;
using IsraelHiking.DataAccessInterfaces;
using Microsoft.Extensions.FileProviders;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using Microsoft.VisualStudio.TestTools.UnitTesting;
using NSubstitute;

namespace IsraelHiking.API.Tests.Services
{
    [TestClass]
    public class OfflineFilesServiceTests
    {
        private OfflineFilesService _service;
        private IFileSystemHelper _fileSystemHelper;
        private IReceiptValidationGateway _receiptValidationGateway;
        private IFileProvider _fileProvider;
        
        [TestInitialize]
        public void TestInitialize()
        {
            _fileSystemHelper = Substitute.For<IFileSystemHelper>();
            _fileProvider = Substitute.For<IFileProvider>();
            _fileSystemHelper.CreateFileProvider(Arg.Any<string>()).Returns(_fileProvider);
            _receiptValidationGateway = Substitute.For<IReceiptValidationGateway>();
            var options = Substitute.For<IOptions<ConfigurationData>>();
            options.Value.Returns(new ConfigurationData());
            _service = new OfflineFilesService(_fileSystemHelper, _receiptValidationGateway, options, Substitute.For<ILogger>());
        }

        [TestMethod]
        public void ConstructWithoutFolder_ShouldNotCreateFileProviderAgain()
        {
            var options = Substitute.For<IOptions<ConfigurationData>>();
            options.Value.Returns(new ConfigurationData { OfflineFilesFolder = string.Empty});
            _service = new OfflineFilesService(_fileSystemHelper, _receiptValidationGateway, options, Substitute.For<ILogger>());

            _fileSystemHelper.Received(1).CreateFileProvider(Arg.Any<string>());
        }
        
        [TestMethod]
        public void GetUpdatedFilesList_NotEntitled_ShouldReturnEmptyList()
        {
            var results = _service.GetUpdatedFilesList("42", new DateTime(0)).Result;
            
            Assert.AreEqual(0, results.Count);
        }
        
        [TestMethod]
        public void GetUpdatedFilesList_OneHidden_ShouldReturnEmptyList()
        {
            _receiptValidationGateway.IsEntitled(Arg.Any<string>()).Returns(true);
            var fileInfo = Substitute.For<IFileInfo>();
            var directory = Substitute.For<IDirectoryContents>();
            var files = new List<IFileInfo> {fileInfo} as IEnumerable<IFileInfo>;
            directory.GetEnumerator().Returns(_ => files.GetEnumerator());
            _fileProvider.GetDirectoryContents(Arg.Any<string>()).Returns(directory);
            _fileSystemHelper.IsHidden(Arg.Any<string>()).Returns(true);
            
            var results = _service.GetUpdatedFilesList("42", new DateTime(0)).Result;
            
            Assert.AreEqual(0, results.Count);
        }
        
        [TestMethod]
        public void GetUpdatedFilesList_OneUpToDate_ShouldReturnEmptyList()
        {
            var lastModified = DateTime.Now;
            _receiptValidationGateway.IsEntitled(Arg.Any<string>()).Returns(true);
            var fileInfo = Substitute.For<IFileInfo>();
            fileInfo.LastModified.Returns(lastModified);
            var directory = Substitute.For<IDirectoryContents>();
            var files = new List<IFileInfo> {fileInfo} as IEnumerable<IFileInfo>;
            directory.GetEnumerator().Returns(_ => files.GetEnumerator());
            _fileProvider.GetDirectoryContents(Arg.Any<string>()).Returns(directory);
            _fileSystemHelper.IsHidden(Arg.Any<string>()).Returns(false);
            
            var results = _service.GetUpdatedFilesList("42", lastModified).Result;
            
            Assert.AreEqual(0, results.Count);
        }
        
        [TestMethod]
        public void GetUpdatedFilesList_OneNotUpToDate_ShouldReturnOneFile()
        {
            var lastModified = DateTime.Now.Subtract(TimeSpan.FromDays(10));
            _receiptValidationGateway.IsEntitled(Arg.Any<string>()).Returns(true);
            var fileInfo = Substitute.For<IFileInfo>();
            fileInfo.LastModified.Returns(DateTime.Now);
            fileInfo.Name.Returns("some.mbtiles");
            var directory = Substitute.For<IDirectoryContents>();
            var files = new List<IFileInfo> {fileInfo} as IEnumerable<IFileInfo>;
            directory.GetEnumerator().Returns(_ => files.GetEnumerator());
            _fileProvider.GetDirectoryContents(Arg.Any<string>()).Returns(directory);
            _fileSystemHelper.IsHidden(Arg.Any<string>()).Returns(false);
            
            var results = _service.GetUpdatedFilesList("42", lastModified).Result;
            
            Assert.AreEqual(1, results.Count);
        }

        [TestMethod]
        public void GetFileContent_NotEntitled_ShouldReturnNull()
        {
            _receiptValidationGateway.IsEntitled(Arg.Any<string>()).Returns(false);

            var stream = _service.GetFileContent("42", "fileName").Result;
            
            Assert.IsNull(stream);
        }
        
        [TestMethod]
        public void GetFileContent_NotEntitled_ShouldReturnTheContent()
        {
            _receiptValidationGateway.IsEntitled(Arg.Any<string>()).Returns(true);
            var fileInfo = Substitute.For<IFileInfo>();
            _fileProvider.GetFileInfo(Arg.Any<string>()).Returns(fileInfo);
            
            _service.GetFileContent("42", "fileName").Wait();

            fileInfo.Received(1).CreateReadStream();
        }
    }
}