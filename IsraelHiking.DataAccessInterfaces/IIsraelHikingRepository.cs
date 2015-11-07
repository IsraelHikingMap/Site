using IsraelHiking.Common;
using System;

namespace IsraelHiking.DataAccessInterfaces
{
    public interface IIsraelHikingRepository : IDisposable
    {
        void AddUrl(SiteUrl siteUrl);
        SiteUrl GetUrlById(string id);
        SiteUrl GetUrlByModifyKey(string modifyKey);
        void Update(object obj);
    }
}