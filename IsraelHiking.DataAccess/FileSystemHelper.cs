using System;
using System.IO;
using System.Linq;
using IsraelHiking.DataAccessInterfaces;

namespace IsraelHiking.DataAccess
{
    public class FileSystemHelper : IFileSystemHelper
    {
        public bool Exists(string path)
        {
            return Directory.Exists(path) || File.Exists(path);
        }

        public long GetFileSize(string path)
        {
            return File.Exists(path) ? new FileInfo(path).Length : 0;
        }

        public string[] GetNonHiddenDirectories(string path)
        {
            return Directory.GetDirectories(path)
                .Where(d => !new DirectoryInfo(d).Attributes.HasFlag(FileAttributes.Hidden))
                .ToArray();
        }

        public string[] GetNonHiddenFiles(string path)
        {
            return Directory.GetFiles(path)
                .Where(f => !new FileInfo(f).Attributes.HasFlag(FileAttributes.Hidden) && !f.EndsWith("web.config"))
                .ToArray();
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

        public void WriteAllBytes(string filePath, byte[] content)
        {
            File.WriteAllBytes(filePath, content);
        }

        public Stream FileOpenRead(string filePath)
        {
            return File.OpenRead(filePath);
        }
    }
}
