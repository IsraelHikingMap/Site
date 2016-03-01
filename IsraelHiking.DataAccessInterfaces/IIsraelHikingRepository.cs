using IsraelHiking.Common;
using System;
using System.Threading.Tasks;

namespace IsraelHiking.DataAccessInterfaces
{
    public interface IIsraelHikingRepository : IDisposable
    {
        Task AddUrl(SiteUrl siteUrl);
        Task<SiteUrl> GetUrlById(string id);
        Task<SiteUrl> GetUrlByModifyKey(string modifyKey);
        Task Update(object obj);
    }
}