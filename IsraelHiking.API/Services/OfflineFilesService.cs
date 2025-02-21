using IsraelHiking.Common.Configuration;
using IsraelHiking.DataAccessInterfaces;
using Microsoft.Extensions.FileProviders;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using System;
using System.Collections.Generic;
using System.IO;

namespace IsraelHiking.API.Services;

/// <inheritdoc/>
public class OfflineFilesService : IOfflineFilesService
{
    private readonly IFileProvider _fileProvider;
    private readonly IFileSystemHelper _fileSystemHelper;

    /// <summary>
    /// Constructor
    /// </summary>
    /// <param name="fileSystemHelper"></param>
    /// <param name="options"></param>
    /// <param name="logger"></param>
    public OfflineFilesService(IFileSystemHelper fileSystemHelper,
        IOptions<ConfigurationData> options,
        ILogger logger)
    {
        _fileSystemHelper = fileSystemHelper;
        if (string.IsNullOrEmpty(options.Value.OfflineFilesFolder))
        {
            logger.LogWarning("offlineFilesFolder was not provided! This mean you won't be able to use this service");
        }
        else
        {
            _fileProvider = _fileSystemHelper.CreateFileProvider(options.Value.OfflineFilesFolder);
        }
    }

    /// <inheritdoc/>
    public Dictionary<string, DateTime> GetUpdatedFilesList(DateTime lastModifiedDate)
    {
        var filesDictionary = new Dictionary<string, DateTime>();
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
            if (content.Name.EndsWith(".pmtiles") || content.Name.StartsWith("style"))
            {
                filesDictionary[content.Name] = content.LastModified.DateTime;
            }
        }
        return filesDictionary;
    }

    /// <inheritdoc/>
    public Stream GetFileContent(string fileName)
    {
        return _fileProvider.GetFileInfo(fileName).CreateReadStream();
    }
}