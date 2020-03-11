using IsraelHiking.Common;
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
            IOptions<NonPublicConfigurationData> options,
            ILogger logger)
        {
            _fileProvider = new PhysicalFileProvider(options.Value.OfflineFilesFolder);
            _fileSystemHelper = fileSystemHelper;
            _receiptValidationGateway = receiptValidationGateway;
            _logger = logger;
        }

        /// <inheritdoc/>
        public async Task<Dictionary<string, DateTime>> GetUpdatedFilesList(string userId, DateTime lastModifiedDate)
        {
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
                if (lastModifiedDate == DateTime.MinValue || content.LastModified.DateTime - lastModifiedDate > new TimeSpan(0,0,1))
                {
                    filesDictionary[content.Name] = content.LastModified.DateTime;
                }
            }
            return filesDictionary;
        }

        /// <inheritdoc/>
        public async Task<Stream> GetFileContent(string userId, string fileName)
        {
            _logger.LogDebug($"Getting offline file: {fileName} for user: {userId}");
            if (!await _receiptValidationGateway.IsEntitled(userId))
            {
                return null;
            }
            return _fileProvider.GetFileInfo(fileName).CreateReadStream();
        }
    }
}
