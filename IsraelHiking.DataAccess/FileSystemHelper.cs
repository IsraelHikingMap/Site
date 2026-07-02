using System.IO;
using IsraelHiking.DataAccessInterfaces;
using Microsoft.Extensions.FileProviders;

namespace IsraelHiking.DataAccess;

public class FileSystemHelper : IFileSystemHelper
{
    public IFileProvider CreateFileProvider(string path)
    {
        return new PhysicalFileProvider(path);
    }
}