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
        if (string.IsNullOrEmpty(options.Value.OfflineFilesFolder))
        {
            logger.LogWarning("offlineFilesFolder was not provided! This mean you won't be able to use this service");
        }
        else
        {
            _fileProvider = fileSystemHelper.CreateFileProvider(options.Value.OfflineFilesFolder);
        }
    }

    /// <inheritdoc/>
    public Dictionary<string, DateTime> GetUpdatedFilesList(DateTime lastModifiedDate, long tileX, long tileY)
    {
        var filesDictionary = new Dictionary<string, DateTime>();
        var relativePath = "7/" + tileX + "/" + tileY;
        var zoom7Folder = _fileProvider.GetDirectoryContents(relativePath);
        foreach (var content in zoom7Folder)
        {
            if (lastModifiedDate != DateTime.MinValue && content.LastModified.DateTime.ToUniversalTime() - lastModifiedDate.ToUniversalTime() <= new TimeSpan(0, 0, 1))
            {
                continue;
            }
            filesDictionary[relativePath + "/" + content.Name] = content.LastModified.DateTime;
        }
        var rootFolder = _fileProvider.GetDirectoryContents(string.Empty);
        foreach (var content in rootFolder)
        {
            if (content.IsDirectory)
            {
                continue;
            }
            if (lastModifiedDate != DateTime.MinValue && content.LastModified.DateTime.ToUniversalTime() - lastModifiedDate.ToUniversalTime() <= new TimeSpan(0, 0, 1))
            {
                continue;
            }
            filesDictionary[content.Name] = content.LastModified.DateTime;
        }
        return filesDictionary;
    }

    /// <inheritdoc/>
    public Stream GetFileContent(string fileName)
    {
        return _fileProvider.GetFileInfo(fileName).CreateReadStream();
    }
}