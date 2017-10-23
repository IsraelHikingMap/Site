using System.Diagnostics.CodeAnalysis;
using IsraelHiking.Common;
using Microsoft.EntityFrameworkCore;

namespace IsraelHiking.DataAccess.Database
{
    [ExcludeFromCodeCoverage]
    public class IsraelHikingDbContext : DbContext
    {
        public DbSet<SiteUrl> SiteUrls { get; set; }
        public DbSet<UserLayers> UsersLayers { get; set; }
        
        protected override void OnConfiguring(DbContextOptionsBuilder optionsBuilder)
        {
            optionsBuilder.UseSqlite("Filename=./IsraelHiking.sqlite");
        }
    }
}
