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

namespace IsraelHiking.API.Tests.Services;

[TestClass]
public class OfflineFilesServiceTests
{
    private OfflineFilesService _service;
    private IFileSystemHelper _fileSystemHelper;
    private IFileProvider _fileProvider;
        
    [TestInitialize]
    public void TestInitialize()
    {
        _fileSystemHelper = Substitute.For<IFileSystemHelper>();
        _fileProvider = Substitute.For<IFileProvider>();
        _fileSystemHelper.CreateFileProvider(Arg.Any<string>()).Returns(_fileProvider);
        var options = Substitute.For<IOptions<ConfigurationData>>();
        options.Value.Returns(new ConfigurationData());
        _service = new OfflineFilesService(_fileSystemHelper, options, Substitute.For<ILogger>());
    }

    [TestMethod]
    public void ConstructWithoutFolder_ShouldNotCreateFileProviderAgain()
    {
        var options = Substitute.For<IOptions<ConfigurationData>>();
        options.Value.Returns(new ConfigurationData {OfflineFilesFolder = string.Empty});
        _service = new OfflineFilesService(_fileSystemHelper, options,
            Substitute.For<ILogger>());

        _fileSystemHelper.Received(1).CreateFileProvider(Arg.Any<string>());
    }
        
    [TestMethod]
    public void GetUpdatedFilesList_OneUpToDate_ShouldReturnEmptyList()
    {
        var lastModified = DateTime.Now;
        var fileInfo = Substitute.For<IFileInfo>();
        fileInfo.LastModified.Returns(lastModified);
        var directory = Substitute.For<IDirectoryContents>();
        var files = new List<IFileInfo> {fileInfo} as IEnumerable<IFileInfo>;
        directory.GetEnumerator().Returns(_ => files.GetEnumerator());
        _fileProvider.GetDirectoryContents(Arg.Any<string>()).Returns(directory);
        _fileSystemHelper.IsHidden(Arg.Any<string>()).Returns(false);
            
        var results = _service.GetUpdatedFilesList(lastModified, 1, 2);
            
        Assert.AreEqual(0, results.Count);
    }
        
    [TestMethod]
    public void GetUpdatedFilesList_OneNotUpToDate_ShouldReturnOneFile()
    {
        var lastModified = DateTime.Now.Subtract(TimeSpan.FromDays(10));
        var fileInfo = Substitute.For<IFileInfo>();
        fileInfo.LastModified.Returns(DateTime.Now);
        fileInfo.Name.Returns("some.pmtiles");
        var directory = Substitute.For<IDirectoryContents>();
        var files = new List<IFileInfo> {fileInfo} as IEnumerable<IFileInfo>;
        directory.GetEnumerator().Returns(_ => files.GetEnumerator());
        _fileProvider.GetDirectoryContents(Arg.Any<string>()).Returns(directory);
        _fileSystemHelper.IsHidden(Arg.Any<string>()).Returns(false);
            
        var results = _service.GetUpdatedFilesList(lastModified, 1, 2);
            
        Assert.AreEqual(2, results.Count);
    }

    [TestMethod]
    public void GetFileContent_NotEntitled_ShouldReturnTheContent()
    {
        var fileInfo = Substitute.For<IFileInfo>();
        _fileProvider.GetFileInfo(Arg.Any<string>()).Returns(fileInfo);
            
        _service.GetFileContent("fileName");

        fileInfo.Received(1).CreateReadStream();
    }
}