using IsraelHiking.Common;
using System;

namespace IsraelHiking.DataAccessInterfaces
{
    public interface IIsraelHikingRepository : IDisposable
    {
        void AddShortUrl(ShortUrl shortUrl);
        ShortUrl GetShortUrlById(string id);
        ShortUrl GetShortUrlByModifyKey(string modifyKey);
        void Update(object obj);
    }
}