using IsraelHiking.Common;
using SQLite.CodeFirst;
using System.Data.Entity;
using System.Data.Entity.ModelConfiguration.Conventions;

namespace IsraelHiking.DataAccess.Database
{
    public class IsraelHikingDbContext : DbContext
    {
        public DbSet<ShortUrl> ShortUrls { get; set; }

        public IsraelHikingDbContext()
            : base("IsraelHikingDbContext")
        {
            Configuration.ProxyCreationEnabled = true;
        }

        protected override void OnModelCreating(DbModelBuilder modelBuilder)
        {
            modelBuilder.Conventions.Remove<PluralizingTableNameConvention>();
            System.Data.Entity.Database.SetInitializer(new SqliteCreateDatabaseIfNotExists<IsraelHikingDbContext>(modelBuilder));
        }
    }
}
