using System;

namespace IsraelHiking.Common.FileExplorer
{
    public class FileSystemEntry
    {
        public string Link { get; set; }
        public string Name { get; set; }
        public long Size { get; set; }
        public DateTime LastModified { get; set; }
    }
}
