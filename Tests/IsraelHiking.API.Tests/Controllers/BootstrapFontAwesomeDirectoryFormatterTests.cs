using System;
using System.Collections.Generic;
using IsraelHiking.API.Controllers;
using IsraelHiking.DataAccessInterfaces;
using Microsoft.VisualStudio.TestTools.UnitTesting;
using NSubstitute;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.FileProviders;
using System.IO;
using System.Text;

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
        public void GenerateContentAsync_ContentsAreNull_ShouldThrow()
        {
            _formatter.GenerateContentAsync(Substitute.For<HttpContext>(), null).Wait();
        }

        [TestMethod]
        public void GenerateContentAsync_HeadRequest_ShouldReturnNothing()
        {
            var context = new DefaultHttpContext();
            var stream = new MemoryStream();
            context.Response.Body = stream;
            context.Request.Method = "HEAD";

            _formatter.GenerateContentAsync(context, new IFileInfo[0]).Wait();

            Assert.AreEqual(0, stream.ToArray().Length);
        }
        
        [TestMethod]
        public void GenerateContentAsync_ForDeeperPath_ShouldReturnFiles()
        {
            var context = new DefaultHttpContext();
            var stream = new MemoryStream();
            context.Response.Body = stream;
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
            var html = Encoding.UTF8.GetString(stream.ToArray());
            
            Assert.IsTrue(html.Contains("fa-file-zip"));
            Assert.IsTrue(html.Contains("fa-file-code"));
            Assert.IsTrue(html.Contains("fa-file-image"));
            Assert.IsTrue(html.Contains("fa-file-text"));
            Assert.IsTrue(html.Contains("fa-folder-open"));
            Assert.IsTrue(html.Contains("Gb"));
            Assert.IsTrue(html.Contains("Mb"));
            Assert.IsTrue(html.Contains("Kb"));
            Assert.IsTrue(html.Contains(" b"));
        }
    }
}
