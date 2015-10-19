using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace IsraelHiking.DataAccess.Database
{
    public class ShortUrl
    {
        [Key]
        public string Id { get; set; }
        public DateTime CreationDate { get; set; }
        public DateTime LastViewed { get; set; }
        public string FullUrl { get; set; }
        public string ModifyKey { get; set; }
        public int ViewsCount { get; set; }
    }
}
