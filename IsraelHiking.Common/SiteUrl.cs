using System;
using System.ComponentModel.DataAnnotations;

namespace IsraelHiking.Common
{
    public class SiteUrl
    {
        [Key]
        public string Id { get; set; }
        public string Title { get; set; }
        public DateTime CreationDate { get; set; }
        public DateTime LastViewed { get; set; }
        public string JsonData { get; set; }
        public string ModifyKey { get; set; }
        public int ViewsCount { get; set; }
        //public byte[] Thumbnail { get; set; }
    }
}
