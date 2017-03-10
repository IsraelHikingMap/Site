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

        public bool IsHidden(string path)
        {
            if (Directory.Exists(path))
            {
                return new DirectoryInfo(path).Attributes.HasFlag(FileAttributes.Hidden);
            }
            if (File.Exists(path))
            {
                return new FileInfo(path).Attributes.HasFlag(FileAttributes.Hidden) && !path.EndsWith("web.config");
            }
            return false;
        }

        public long GetSize(string path)
        {
            return File.Exists(path) ? new FileInfo(path).Length : 0;
        }

        public void WriteAllBytes(string filePath, byte[] content)
        {
            File.WriteAllBytes(filePath, content);
        }

        public Stream FileOpenRead(string filePath)
        {
            return File.OpenRead(filePath);
        }

        public string GetCurrentDirectory()
        {
            return Directory.GetCurrentDirectory();
        }
    }
}
