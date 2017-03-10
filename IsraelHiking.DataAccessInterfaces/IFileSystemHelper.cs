using System;
using System.IO;

namespace IsraelHiking.DataAccessInterfaces
{
    public interface IFileSystemHelper
    {
        bool Exists(string path);
        bool IsHidden(string path);
        long GetSize(string fileName);
        void WriteAllBytes(string filePath, byte[] content);
        Stream FileOpenRead(string filePath);
        string GetCurrentDirectory();
    }
}