using System.Collections.Generic;

namespace IsraelHiking.Common.FileExplorer
{
    public class FileExplorerViewModel
    {
        public List<FileSystemEntry> Entries { get; set; }
        public List<FileSystemEntry> CurrentEntryPath { get; set; } 

        public FileExplorerViewModel()
        {
            Entries = new List<FileSystemEntry>();
            CurrentEntryPath = new List<FileSystemEntry>();
        }
    }
}