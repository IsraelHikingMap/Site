using System;
using System.Data.Entity;
using System.IO;
using Microsoft.Owin.FileSystems;

namespace IsraelHiking.DataAccessInterfaces
{
    public static class IFileProviderExtensions
    {
        // temporary until migration to .Net Core
        public static bool Exists(this IFileInfo fileInfo)
        {
            return File.Exists(fileInfo.PhysicalPath) || Directory.Exists(fileInfo.PhysicalPath);
        }
    }

    public interface IFileProvider
    {
        IFileInfo GetFileInfo(string path);
    }

    public interface IFileSystemHelper
    {
        bool IsHidden(string path);
        void WriteAllBytes(string filePath, byte[] content);
        string GetCurrentDirectory();
    }
}