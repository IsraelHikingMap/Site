using IsraelHiking.Common;
using Microsoft.EntityFrameworkCore;

namespace IsraelHiking.DataAccess.Database
{
    public class IsraelHikingDbContext : DbContext
    {
        public DbSet<SiteUrl> SiteUrls { get; set; }

        protected override void OnConfiguring(DbContextOptionsBuilder optionsBuilder)
        {
            optionsBuilder.UseSqlite("Filename=./IsraelHiking.sqlite");
        }
    }
}
