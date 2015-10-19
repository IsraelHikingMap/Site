using IsraelHiking.DataAccess.Database;
using Microsoft.VisualStudio.TestTools.UnitTesting;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

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
            var shortUrl = new ShortUrl();
            shortUrl.CreationDate = DateTime.Now;
            var list = context.ShortUrls.ToList();
            Assert.AreEqual(0, list.Count);
        }
    }
}
