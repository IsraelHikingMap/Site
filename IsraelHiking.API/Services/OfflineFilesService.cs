using IsraelHiking.Common.Configuration;
using IsraelHiking.DataAccessInterfaces;
using Microsoft.Extensions.FileProviders;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using System;
using System.Collections.Generic;
using System.IO;
using System.Threading.Tasks;

namespace IsraelHiking.API.Services
{
    /// <inheritdoc/>
    public class OfflineFilesService : IOfflineFilesService
    {
        private readonly PhysicalFileProvider _fileProvider;
        private readonly IFileSystemHelper _fileSystemHelper;
        private readonly IReceiptValidationGateway _receiptValidationGateway;
        private readonly ILogger _logger;

        /// <summary>
        /// Constructor
        /// </summary>
        /// <param name="fileSystemHelper"></param>
        /// <param name="receiptValidationGateway"></param>
        /// <param name="options"></param>
        /// <param name="logger"></param>
        public OfflineFilesService(IFileSystemHelper fileSystemHelper,
            IReceiptValidationGateway receiptValidationGateway,
            IOptions<ConfigurationData> options,
            ILogger logger)
        {
            _logger = logger;
            if (string.IsNullOrEmpty(options.Value.OfflineFilesFolder))
            {
                _logger.LogWarning("offlineFilesFolder was not provided! This mean you won't be able to use this service");
            }
            else
            {
                _fileProvider = new PhysicalFileProvider(options.Value.OfflineFilesFolder);
            }
            
            _fileSystemHelper = fileSystemHelper;
            _receiptValidationGateway = receiptValidationGateway;
        }

        /// <inheritdoc/>
        public async Task<Dictionary<string, DateTime>> GetUpdatedFilesList(string userId, DateTime lastModifiedDate)
        {
            _logger.LogInformation($"Getting the list of offline files for user: {userId}, date: {lastModifiedDate}");
            var filesDictionary = new Dictionary<string, DateTime>();
            if (!await _receiptValidationGateway.IsEntitled(userId))
            {
                return new Dictionary<string, DateTime>();
            }
            var contents = _fileProvider.GetDirectoryContents(string.Empty);
            foreach (var content in contents)
            {
                if (_fileSystemHelper.IsHidden(content.PhysicalPath))
                {
                    continue;
                }
                if (lastModifiedDate != DateTime.MinValue && content.LastModified.DateTime.ToUniversalTime() - lastModifiedDate.ToUniversalTime() <= new TimeSpan(0, 0, 1))
                {
                    continue;
                }
                if (content.Name.EndsWith(".mbtiles") || content.Name.StartsWith("style"))
                {
                    filesDictionary[content.Name] = content.LastModified.DateTime;
                }
            }
            return filesDictionary;
        }

        /// <inheritdoc/>
        public async Task<Stream> GetFileContent(string userId, string fileName)
        {
            _logger.LogInformation($"Getting offline file: {fileName} for user: {userId}");
            if (!await _receiptValidationGateway.IsEntitled(userId))
            {
                return null;
            }
            return _fileProvider.GetFileInfo(fileName).CreateReadStream();
        }
    }
}
