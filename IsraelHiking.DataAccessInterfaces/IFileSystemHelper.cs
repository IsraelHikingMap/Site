using System;

namespace IsraelHiking.DataAccessInterfaces
{
    public interface IFileSystemHelper
    {
        bool Exists(string path);
        string[] GetDirectories(string path);
        string[] GetFiles(string path);
        DateTime GetLastModifiedDate(string path);
        string GetShortName(string path);
        long GetSize(string fileName);
    }
}