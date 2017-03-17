using System.IO;
using IsraelHiking.DataAccessInterfaces;

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
    }
}
