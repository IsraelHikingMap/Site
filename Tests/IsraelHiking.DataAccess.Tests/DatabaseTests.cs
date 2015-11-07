using IsraelHiking.Common;
using IsraelHiking.DataAccess.Database;
using Microsoft.VisualStudio.TestTools.UnitTesting;
using System;
using System.Linq;

namespace IsraelHiking.DataAccess.Tests
{
    [TestClass]
    public class DatabaseTests
    {
        [TestMethod]
        [Ignore]
        public void NoDatabaseFile_CreateDatabase_DatabaseShouldBeCreated()
        {
            var context = new IsraelHikingDbContext();
            var siteUrl = new SiteUrl();
            siteUrl.CreationDate = DateTime.Now;
            var list = context.SiteUrls.ToList();
            Assert.AreEqual(0, list.Count);
        }
    }
}
