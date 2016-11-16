using IsraelHiking.Common;
using System;
using System.Collections.Generic;
using System.Threading.Tasks;

namespace IsraelHiking.DataAccessInterfaces
{
    public interface IIsraelHikingRepository : IDisposable
    {
        Task AddUrl(SiteUrl siteUrl);
        Task<SiteUrl> GetUrlById(string id);
        Task<List<SiteUrl>> GetUrlsByUser(string osmUserId);
        Task Delete(SiteUrl siteUrl);
        Task Update(object obj);
    }
}