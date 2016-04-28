using IsraelHiking.Common;
using IsraelHiking.DataAccessInterfaces;
using System.Data.Entity;
using System.Threading.Tasks;

namespace IsraelHiking.DataAccess.Database
{
    public class IsraelHikingRepository : IIsraelHikingRepository
    {
        private IIsraelHikingDbContext _dbContext;

        public IsraelHikingRepository(IIsraelHikingDbContext context)
        {
            _dbContext = context;
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
            _dbContext.MarkAsModified(obj);
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
