using System.IO;
using IsraelHiking.DataAccessInterfaces;
using Microsoft.Extensions.FileProviders;

namespace IsraelHiking.DataAccess
{
    public class FileSystemHelper : IFileSystemHelper
    {
        public bool IsHidden(string path)
        {
            if (Directory.Exists(path))
            {
                return new DirectoryInfo(path).Attributes.HasFlag(FileAttributes.Hidden);
            }
            if (File.Exists(path))
            {
                return new FileInfo(path).Attributes.HasFlag(FileAttributes.Hidden) 
                    || path.EndsWith("web.config") || path.EndsWith(".finger");
            }
            return false;
        }

        public void WriteAllBytes(string filePath, byte[] content)
        {
            File.WriteAllBytes(filePath, content);
        }

        public void WriteAllText(string filePath, string content)
        {
            File.WriteAllText(filePath, content);
        }

        public string GetCurrentDirectory()
        {
            return Directory.GetCurrentDirectory();
        }

        public void CreateDirectory(string path)
        {
            Directory.CreateDirectory(path);
        }

        public void Move(string sourceFileName, string targetFileName)
        {
            if (File.Exists(targetFileName))
            {
                File.Delete(targetFileName);
            }
            File.Move(sourceFileName, targetFileName);
        }

        public Stream CreateWriteStream(string filePath)
        {
            return File.Create(filePath);
        }

        public IFileProvider CreateFileProvider(string path)
        {
            return new PhysicalFileProvider(path);
        }
    }
}
