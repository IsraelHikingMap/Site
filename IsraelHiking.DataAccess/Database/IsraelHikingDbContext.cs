using IsraelHiking.Common;
using SQLite.CodeFirst;
using System.Data.Entity;
using System.Data.Entity.ModelConfiguration.Conventions;
using System.Diagnostics.CodeAnalysis;
using IsraelHiking.DataAccessInterfaces;

namespace IsraelHiking.DataAccess.Database
{
    [ExcludeFromCodeCoverage]
    public class IsraelHikingDbContext : DbContext, IIsraelHikingDbContext
    {
        public IDbSet<SiteUrl> SiteUrls { get; set; }

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

        public void MarkAsModified(object obj)
        {
            Entry(obj).State = EntityState.Modified;
        }
    }
}
