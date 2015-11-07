using IsraelHiking.Common;
using IsraelHiking.DataAccessInterfaces;
using System.Data.Entity;
using System.Linq;
using System;

namespace IsraelHiking.DataAccess.Database
{
    public class IsraelHikingRepository : IIsraelHikingRepository
    {
        private IsraelHikingDbContext _dbContext;

        public IsraelHikingRepository()
        {
            _dbContext = new IsraelHikingDbContext();
        }

        public ShortUrl GetShortUrlById(string id)
        {
            return _dbContext.ShortUrls.FirstOrDefault(s => s.Id == id);
        }

        public ShortUrl GetShortUrlByModifyKey(string modifyKey)
        {
            return _dbContext.ShortUrls.FirstOrDefault(s => s.ModifyKey == modifyKey);
        }

        public void AddShortUrl(ShortUrl shortUrl)
        {
            _dbContext.ShortUrls.Add(shortUrl);
            _dbContext.SaveChanges();
        }

        public void Update(object obj)
        {
            _dbContext.Entry(obj).State = EntityState.Modified;
            _dbContext.SaveChanges();
        }

        public void Dispose()
        {
            if (_dbContext != null)
            {
                _dbContext.Dispose();
                _dbContext = null;
            }
        }
    }
}
