using System;
using System.IO;
using IsraelHiking.DataAccessInterfaces;
using Microsoft.Owin.FileSystems;

namespace IsraelHiking.DataAccess
{
    public class FileSystemHelper : IFileSystemHelper, IFileProvider
    {

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


        public void WriteAllBytes(string filePath, byte[] content)
        {
            File.WriteAllBytes(filePath, content);
        }

        public string GetCurrentDirectory()
        {
            return Directory.GetCurrentDirectory();
        }

        private class IHMFileInfo : IFileInfo
        {
            private readonly string _path;

            public IHMFileInfo(string path)
            {
                _path = path;
            }

            public Stream CreateReadStream()
            {
                return File.OpenRead(_path);
            }

            public long Length => new FileInfo(_path).Length;

            public string PhysicalPath => _path;
            public string Name => new FileInfo(_path).Name;
            public DateTime LastModified => new FileInfo(_path).LastWriteTime;
            public bool IsDirectory => Directory.Exists(_path);
        }

        public IFileInfo GetFileInfo(string path)
        {
            return new IHMFileInfo(path);
        }
    }
}
