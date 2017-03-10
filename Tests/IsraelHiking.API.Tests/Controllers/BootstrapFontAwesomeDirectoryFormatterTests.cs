using System;
using System.Collections.Generic;
using System.IO;
using System.Net.Http;
using IsraelHiking.API.Controllers;
using IsraelHiking.DataAccessInterfaces;
using Microsoft.Owin;
using Microsoft.Owin.FileSystems;
using Microsoft.VisualStudio.TestTools.UnitTesting;
using NSubstitute;

namespace IsraelHiking.API.Tests.Controllers
{
    [TestClass]
    public class BootstrapFontAwesomeDirectoryFormatterTests
    {
        private BootstrapFontAwesomeDirectoryFormatter _formatter;
        private IFileSystemHelper _fileSystemHelper;
        private const string EXAMPLE_DIRECTORY = @"C:\Exmple";

        [TestInitialize]
        public void TestInitialize()
        {
            _fileSystemHelper = Substitute.For<IFileSystemHelper>();
            _formatter = new BootstrapFontAwesomeDirectoryFormatter(_fileSystemHelper);
        }

        [TestMethod]
        [ExpectedException(typeof(AggregateException))]
        public void GenerateContentAsync_ContextIsNull_ShouldThrow()
        {
            _formatter.GenerateContentAsync(null, null).Wait();
        }

        [TestMethod]
        [ExpectedException(typeof(AggregateException))]
        public void GenerateContentAsync_ContentIsNull_ShouldThrow()
        {
            _formatter.GenerateContentAsync(Substitute.For<IOwinContext>(), null).Wait();
        }

        [TestMethod]
        public void GenerateContentAsync_HeadRequest_ShouldReturnNothing()
        {
            var context = Substitute.For<IOwinContext>();
            var response = Substitute.For<IOwinResponse>();
            context.Response.Returns(response);
            var request = Substitute.For<IOwinRequest>();
            request.Method = "HEAD";
            context.Request.Returns(request);

            _formatter.GenerateContentAsync(context, new IFileInfo[0]).Wait();

            response.DidNotReceive().WriteAsync(Arg.Any<byte[]>());
        }
        
        [TestMethod]
        public void GenerateContentAsync_ForDeeperPath_ShouldReturnFiles()
        {
            var context = Substitute.For<IOwinContext>();
            var response = Substitute.For<IOwinResponse>();
            context.Response.Returns(response);
            var request = Substitute.For<IOwinRequest>();
            context.Request.Returns(request);

            
            var fileNames = new[] {"zipfile.zip", "image.png", "xml.xml", "text.txt"};
            var content = new List<IFileInfo>();
            _fileSystemHelper.IsHidden(Arg.Any<string>()).Returns(false);
            for (int index = 0; index < fileNames.Length; index++)
            {
                var file = Substitute.For<IFileInfo>();
                file.Name.Returns(fileNames[index]);
                file.Length.Returns((int)Math.Pow(1024, index) + 1);
                file.IsDirectory.Returns(false);
                content.Add(file);
            }
            var folder = Substitute.For<IFileInfo>();
            folder.IsDirectory.Returns(true);
            folder.Name.Returns("dir1");
            content.Add(folder);

            _formatter.GenerateContentAsync(context, content).Wait();

            response.Received().WriteAsync(Arg.Is<string>(html =>
                    html.Contains("fa-file-zip") &&
                    html.Contains("fa-file-code") &&
                    html.Contains("fa-file-image") &&
                    html.Contains("fa-file-text") &&
                    html.Contains("fa-folder-open") &&
                    html.Contains("Gb") &&
                    html.Contains("Mb") &&
                    html.Contains("Kb") &&
                    html.Contains(" b")
            ));
        }
    }
}
