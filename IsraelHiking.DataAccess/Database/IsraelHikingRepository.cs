using IsraelHiking.Common;
using IsraelHiking.DataAccessInterfaces;
using System.Data.Entity;
using System.Linq;
using System;
using System.Threading.Tasks;

namespace IsraelHiking.DataAccess.Database
{
    public class IsraelHikingRepository : IIsraelHikingRepository
    {
        private IsraelHikingDbContext _dbContext;

        public IsraelHikingRepository()
        {
            _dbContext = new IsraelHikingDbContext();
        }

        public Task<SiteUrl> GetUrlById(string id)
        {
            return _dbContext.SiteUrls.FirstOrDefaultAsync(s => s.Id == id);
        }

        public Task<SiteUrl> GetUrlByModifyKey(string modifyKey)
        {
            return _dbContext.SiteUrls.FirstOrDefaultAsync(s => s.ModifyKey == modifyKey);
        }

        public async Task AddUrl(SiteUrl siteUrl)
        {
            _dbContext.SiteUrls.Add(siteUrl);
            await _dbContext.SaveChangesAsync().ConfigureAwait(false);
        }

        public async Task Update(object obj)
        {
            _dbContext.Entry(obj).State = EntityState.Modified;
            await _dbContext.SaveChangesAsync().ConfigureAwait(false);
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
