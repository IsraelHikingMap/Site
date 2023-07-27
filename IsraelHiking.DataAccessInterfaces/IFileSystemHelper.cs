using System.IO;
using Microsoft.Extensions.FileProviders;

namespace IsraelHiking.DataAccessInterfaces
{
    public interface IFileSystemHelper
    {
        bool IsHidden(string path);
        void WriteAllBytes(string filePath, byte[] content);
        Stream CreateWriteStream(string filePath);
        IFileProvider CreateFileProvider(string path);
    }
}