namespace IsraelHiking.DataAccessInterfaces
{
    public interface IFileSystemHelper
    {
        bool IsHidden(string path);
        void WriteAllBytes(string filePath, byte[] content);
        string GetCurrentDirectory();
        void CreateDirectory(string path);
    }
}