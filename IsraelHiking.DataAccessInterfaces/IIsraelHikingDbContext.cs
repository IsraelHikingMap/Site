using System;
using System.Data.Entity;
using System.Threading.Tasks;
using IsraelHiking.Common;

namespace IsraelHiking.DataAccessInterfaces
{
    public interface IIsraelHikingDbContext :  IDisposable
    {
        IDbSet<SiteUrl> SiteUrls { get; set; }
        Task<int> SaveChangesAsync();
        void MarkAsModified(object obj);
    }
}