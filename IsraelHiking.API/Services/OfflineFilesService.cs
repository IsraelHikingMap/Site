using IsraelHiking.Common;
using IsraelHiking.DataAccessInterfaces;
using Microsoft.Extensions.FileProviders;
using Microsoft.Extensions.Options;
using System;
using System.Collections.Generic;
using System.IO;

namespace IsraelHiking.API.Services
{
    /// <inheritdoc/>
    public class OfflineFilesService : IOfflineFilesService
    {
        private readonly PhysicalFileProvider _fileProvider;
        private readonly IFileSystemHelper _fileSystemHelper;

        /// <summary>
        /// Constructor
        /// </summary>
        /// <param name="fileSystemHelper"></param>
        /// <param name="options"></param>
        public OfflineFilesService(IFileSystemHelper fileSystemHelper,
            IOptions<NonPublicConfigurationData> options)
        {
            _fileProvider = new PhysicalFileProvider(options.Value.OfflineFilesFolder);
            _fileSystemHelper = fileSystemHelper;
        }

        /// <inheritdoc/>
        public List<string> GetUpdatedFilesList(DateTime lastModifiedDate)
        {
            var filesList = new List<string>();
            var contents = _fileProvider.GetDirectoryContents(string.Empty);
            foreach (var content in contents)
            {
                if (_fileSystemHelper.IsHidden(content.PhysicalPath))
                {
                    continue;
                }
                if (lastModifiedDate == DateTime.MinValue || content.LastModified > lastModifiedDate)
                {
                    filesList.Add(content.Name);
                }
            }
            return filesList;
        }

        /// <inheritdoc/>
        public Stream GetFileContent(string fileName)
        {
            return _fileProvider.GetFileInfo(fileName).CreateReadStream();
        }
    }
}
