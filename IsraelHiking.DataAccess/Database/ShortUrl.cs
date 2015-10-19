using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace IsraelHiking.DataAccess.Database
{
    public class ShortUrl
    {
        public int Id { get; set; }
        public DateTime CreationDate { get; set; }
        public DateTime LastViewed { get; set; }
        public string Url { get; set; }
        public string FullUrl { get; set; }
        public string ModifyKey { get; set; }
    }
}
