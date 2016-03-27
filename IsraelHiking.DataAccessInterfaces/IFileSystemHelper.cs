using System;
using System.IO;

namespace IsraelHiking.DataAccessInterfaces
{
    public interface IFileSystemHelper
    {
        bool Exists(string path);
        long GetFileSize(string path);
        string[] GetDirectories(string path);
        string[] GetFiles(string path);
        DateTime GetLastModifiedDate(string path);
        string GetShortName(string path);
        long GetSize(string fileName);
        void WriteAllBytes(string filePath, byte[] content);
        Stream FileOpenRead(string filePath);
    }
}