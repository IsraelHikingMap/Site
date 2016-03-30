using System;
using System.Collections.Generic;
using System.Configuration;
using System.IO;
using System.Linq;
using System.Net.Http;
using System.Net.Http.Headers;
using System.Web.Http;
using IsraelHiking.Common.FileExplorer;
using IsraelHiking.DataAccessInterfaces;

namespace IsraelHiking.API.Controllers
{
    public partial class FileExplorerHtmlTemplate
    {
        private FileExplorerViewModel FileExplorerViewModel { get; }

        public FileExplorerHtmlTemplate(FileExplorerViewModel viewModel)
        {
            FileExplorerViewModel = viewModel;
        }
    }

    public class FileExplorerController : ApiController
    {
        private const string LISTING_KEY_PREFIX = "Listing_";
        public static Dictionary<string, string> ListingDictionary { get; }
        private readonly IFileSystemHelper _fileSystemHelper;

        static FileExplorerController()
        {
            ListingDictionary = ConfigurationManager.AppSettings.AllKeys
                .Where(k => k.StartsWith(LISTING_KEY_PREFIX))
                .ToDictionary(k => k.Substring(LISTING_KEY_PREFIX.Length).ToLower(), k => ConfigurationManager.AppSettings[k]);
        }

        public FileExplorerController(IFileSystemHelper fileSystemHelper)
        {
            _fileSystemHelper = fileSystemHelper;
        }

        public HttpResponseMessage GetListingPage(string path)
        {
            path = path ?? string.Empty;
            var listingPhysicalPath = GetListingPhysicalPath(path);
            var baseUri = GetBaseUri(path);
            var currenUri = string.IsNullOrWhiteSpace(path) ? baseUri : baseUri + path;
            if (_fileSystemHelper.Exists(listingPhysicalPath) == false)
            {
                return ConvertListingToReponse(new FileExplorerViewModel());
            }
            var fullPath = listingPhysicalPath;
            if (string.IsNullOrWhiteSpace(path) == false)
            {
                fullPath = Path.Combine(listingPhysicalPath, path);
            }
            if (_fileSystemHelper.Exists(fullPath) == false)
            {
                return ConvertListingToReponse(new FileExplorerViewModel());
            }
            var fileExplorerViewModel = new FileExplorerViewModel();
            var directories = _fileSystemHelper.GetNonHiddenDirectories(fullPath);
            fileExplorerViewModel.Entries.AddRange(
                directories.Select(directory => new FileSystemEntry
                {
                    Name = _fileSystemHelper.GetShortName(directory) + "/",
                    LastModified = _fileSystemHelper.GetLastModifiedDate(directory),
                    Size = 0,
                    Link = currenUri + _fileSystemHelper.GetShortName(directory) + "/"
                }).ToList());
            var files = _fileSystemHelper.GetNonHiddenFiles(fullPath);
            fileExplorerViewModel.Entries.AddRange(files.Select(file => new FileSystemEntry
            {
                Name = _fileSystemHelper.GetShortName(file),
                LastModified = _fileSystemHelper.GetLastModifiedDate(file),
                Link = currenUri + _fileSystemHelper.GetShortName(file),
                Size = _fileSystemHelper.GetSize(file)
            }).ToList());
            fileExplorerViewModel.CurrentEntryPath.Add(new FileSystemEntry {Name = "/", Link = baseUri});
            foreach (var header in path.Split(new [] {'/'},  StringSplitOptions.RemoveEmptyEntries))
            {
                fileExplorerViewModel.CurrentEntryPath.Add(new FileSystemEntry
                {
                    Name = header + "/",
                    Link = baseUri + header + "/"
                });
            }
            return ConvertListingToReponse(fileExplorerViewModel);
        }

        private string GetListingPhysicalPath(string path)
        {
            var listingKey = Request.RequestUri.Segments.LastOrDefault() ?? string.Empty;
            if (!string.IsNullOrWhiteSpace(path))
            {
                var urlString = Request.RequestUri.ToString();
                var pathPrefix = urlString.Replace(path, "");
                listingKey = pathPrefix.Split(new[] { '/' }, StringSplitOptions.RemoveEmptyEntries).LastOrDefault() ?? string.Empty;
            }
            var key = listingKey.ToLower().TrimEnd('/');
            return ListingDictionary.ContainsKey(key) ? ListingDictionary[key] : string.Empty;
        }

        private string GetBaseUri(string path)
        {
            var requestUri = Request.RequestUri.ToString();
            if (string.IsNullOrWhiteSpace(path) == false)
            {
                requestUri = requestUri.Replace(path, string.Empty);
            }
            return requestUri.EndsWith("/")
                ? requestUri
                : requestUri + "/";
        }

        private HttpResponseMessage ConvertListingToReponse(FileExplorerViewModel fileExplorerViewModel)
        {
            var response = new HttpResponseMessage
            {
                Content = new StringContent(new FileExplorerHtmlTemplate(fileExplorerViewModel).TransformText())
            };
            response.Content.Headers.ContentType = new MediaTypeHeaderValue("text/html");
            return response;
        }
    }
}
