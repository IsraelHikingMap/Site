using System;
using System.IO;
using IsraelHiking.DataAccessInterfaces;

namespace IsraelHiking.DataAccess
{
    public class FileSystemHelper : IFileSystemHelper
    {
        public bool Exists(string path)
        {
            return Directory.Exists(path) || File.Exists(path);
        }

        public string[] GetDirectories(string path)
        {
            return Directory.GetDirectories(path);
        }

        public string[] GetFiles(string path)
        {
            return Directory.GetFiles(path);
        }

        public string GetShortName(string path)
        {
            if (Directory.Exists(path))
            {
                return new DirectoryInfo(path).Name;
            }
            if (File.Exists(path))
            {
                return new FileInfo(path).Name;
            }
            return string.Empty;
        }

        public DateTime GetLastModifiedDate(string path)
        {
            if (Directory.Exists(path))
            {
                return new DirectoryInfo(path).LastWriteTime;
            }
            if (File.Exists(path))
            {
                return new FileInfo(path).LastWriteTime;
            }
            return DateTime.Now;
        }

        public long GetSize(string fileName)
        {
            return new FileInfo(fileName).Length;
        }
    }
}
