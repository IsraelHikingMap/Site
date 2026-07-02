using System.IO;
using Microsoft.Extensions.FileProviders;

namespace IsraelHiking.DataAccessInterfaces;

public interface IFileSystemHelper
{
    IFileProvider CreateFileProvider(string path);
}