using IsraelHiking.Common;
using IsraelHiking.DataAccessInterfaces;
using Microsoft.EntityFrameworkCore;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;

namespace IsraelHiking.DataAccess.Database
{
    public class IsraelHikingRepository : IIsraelHikingRepository
    {
        private IsraelHikingDbContext _dbContext;

        public IsraelHikingRepository(IsraelHikingDbContext context)
        {
            _dbContext = context;
        }

        public Task<SiteUrl> GetUrlById(string id)
        {
            return _dbContext.SiteUrls.FindAsync(id);
        }

        public async Task<List<SiteUrl>> GetUrlsByUser(string osmUserId)
        {
            if (string.IsNullOrWhiteSpace(osmUserId))
            {
                return new List<SiteUrl>();
            }
            return await _dbContext.SiteUrls.Where(s => s.OsmUserId == osmUserId)
                .OrderByDescending(s => s.LastViewed)
                .ToListAsync()
                .ConfigureAwait(false); ;
        }

        public Task Delete(SiteUrl siteUrl)
        {
            _dbContext.SiteUrls.Remove(siteUrl);
            return _dbContext.SaveChangesAsync();
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
