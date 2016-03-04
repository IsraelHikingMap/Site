using System;
using System.IO;
using System.Linq;
using IsraelHiking.Common;
using IsraelHiking.DataAccess.Database;
using IsraelHiking.DataAccessInterfaces;
using Microsoft.VisualStudio.TestTools.UnitTesting;
using NSubstitute;

namespace IsraelHiking.DataAccess.Tests.Database
{
    [TestClass]
    public class IsraeHikingDbContextTests
    {
        /// <summary>
        /// This file name is the same one from the connection string in the app config of the test assembly.
        /// </summary>
        private const string TEST_SQLITE_FILE_NAME = "Test.sqlite";

        /// <summary>
        /// Since there is a problem deleting and recreating the database on the same process all the checks are made in a single test method...
        /// </summary>
        [TestMethod]
        public void NoDatabaseFile_CreateDatabase_DatabaseShouldBeCreated()
        {
            if (File.Exists(TEST_SQLITE_FILE_NAME))
            {
                File.Delete(TEST_SQLITE_FILE_NAME);
            }

            using (var context = new IsraelHikingDbContext())
            {
                var list = context.SiteUrls.ToList();
                Assert.AreEqual(0, list.Count);
                Assert.IsTrue(File.Exists(TEST_SQLITE_FILE_NAME));
            }

            var id = "42";
            using (var context = new IsraelHikingDbContext())
            {
                context.SiteUrls.Add(new SiteUrl {Id = id});
                context.SaveChanges();
            }

            using (var context = new IsraelHikingDbContext())
            {
                Assert.AreEqual(1, context.SiteUrls.Count());
            }
            var key = "key";
            using (var context = new IsraelHikingDbContext())
            {
                var siteUrlToUpdate = new SiteUrl {Id = id, ModifyKey = key};
                context.MarkAsModified(siteUrlToUpdate);
                context.SaveChanges();
            }

            using (var context = new IsraelHikingDbContext())
            {
                Assert.IsNotNull(context.SiteUrls.FirstOrDefault(x => x.ModifyKey == key));
            }
        }
    }
}
