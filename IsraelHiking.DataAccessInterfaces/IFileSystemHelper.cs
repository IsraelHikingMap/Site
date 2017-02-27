using System;
using System.IO;

namespace IsraelHiking.DataAccessInterfaces
{
    public interface IFileSystemHelper
    {
        bool Exists(string path);
        string[] GetNonHiddenDirectories(string path);
        string[] GetNonHiddenFiles(string path);
        DateTime GetLastModifiedDate(string path);
        string GetShortName(string path);
        long GetSize(string fileName);
        void WriteAllBytes(string filePath, byte[] content);
        Stream FileOpenRead(string filePath);
        string GetCurrentDirectory();
    }
}