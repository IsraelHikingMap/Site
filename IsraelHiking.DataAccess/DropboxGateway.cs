using Dropbox.Api;
using IsraelHiking.Common;
using IsraelHiking.DataAccessInterfaces;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using System;
using System.Collections.Concurrent;
using System.Collections.Generic;
using System.Threading.Tasks;

namespace IsraelHiking.DataAccess
{
    internal class FileCacheItem
    {
        public string Name { get; set; }
        public DateTime ServerModified { get; set; }
        public byte[] Content { get; set; }
    }

    public class DropboxGateway : IDropboxGateway
    {
        private const string DROPBOX_OFFLINE_FOLDER = "/offline";

        private readonly ILogger _logger;
        private readonly NonPublicConfigurationData _options;
        private DropboxClient _client;
        private ConcurrentDictionary<string, FileCacheItem> _filesCache;

        public DropboxGateway(ILogger logger,
            IOptions<NonPublicConfigurationData> options)
        {
            _logger = logger;
            _options = options.Value;
            _filesCache = new ConcurrentDictionary<string, FileCacheItem>();
        }

        public void Initialize()
        {
            if (string.IsNullOrEmpty(_options.DropboxApiToken))
            {
                _logger.LogWarning("Dropbox API Token is missing");
            }
            _client = new DropboxClient(_options.DropboxApiToken);
        }

        public async Task<List<string>> GetUpdatedFilesList(DateTime lastModifiedDate)
        {
            var response = await _client.Files.ListFolderAsync(DROPBOX_OFFLINE_FOLDER);
            var filesList = new List<string>();
            foreach (var file in response.Entries)
            {
                if (!file.IsFile)
                {
                    continue;
                }
                if (_filesCache.ContainsKey(file.Name) && file.AsFile.ServerModified > _filesCache[file.Name].ServerModified)
                {
                    _filesCache.TryRemove(file.Name, out var _);
                }
                if (file.AsFile.ServerModified > lastModifiedDate)
                {
                    filesList.Add(file.Name);
                }
            }
            return filesList;
        }

        public async Task<RemoteFileFetcherGatewayResponse> GetFileContent(string fileName)
        {
            _logger.LogInformation($"Getting offline file from dropbox: {fileName}");
            if (_filesCache.TryGetValue(fileName, out var item))
            {
                return new RemoteFileFetcherGatewayResponse
                {
                    FileName = fileName,
                    Content = item.Content
                };
            }
            var response = await _client.Files.DownloadAsync($"{DROPBOX_OFFLINE_FOLDER}/{fileName}");
            var content = await response.GetContentAsByteArrayAsync();
            _filesCache.TryAdd(fileName, new FileCacheItem
            {
                Content = content,
                Name = fileName,
                ServerModified = response.Response.ServerModified
            });
            return new RemoteFileFetcherGatewayResponse
            {
                Content = content,
                FileName = fileName
            };
        }
    }
}
