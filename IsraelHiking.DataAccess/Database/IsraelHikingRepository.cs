using IsraelHiking.Common;
using IsraelHiking.DataAccessInterfaces;
using Microsoft.EntityFrameworkCore;
using System.Collections.Generic;
using System.Diagnostics.CodeAnalysis;
using System.Linq;
using System.Threading.Tasks;

namespace IsraelHiking.DataAccess.Database
{
    [ExcludeFromCodeCoverage]
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
                .ConfigureAwait(false);
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

        public Task<UserLayers> GetUserLayers(string osmUserId)
        {
            return _dbContext.UsersLayers.Include(ul => ul.Layers).FirstOrDefaultAsync(ul => ul.OsmUserId == osmUserId);
        }

        public async Task UpdateUserLayers(string osmUserId, UserLayers newUserLayers)
        {
            _dbContext.UsersLayers.RemoveRange(_dbContext.UsersLayers.Where(ul => ul.OsmUserId == osmUserId));
            newUserLayers.Id = 0;
            newUserLayers.OsmUserId = osmUserId;
            foreach (var newUserLayer in newUserLayers.Layers)
            {
                newUserLayer.Id = 0;
                newUserLayer.Address = newUserLayer.Address.Trim();
                newUserLayer.Key = newUserLayer.Key.Trim();
            }
            _dbContext.UsersLayers.Add(newUserLayers);
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
