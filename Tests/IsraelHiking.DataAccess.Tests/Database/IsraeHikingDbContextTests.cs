using System.IO;
using System.Linq;
using IsraelHiking.Common;
using IsraelHiking.DataAccess.Database;
using Microsoft.VisualStudio.TestTools.UnitTesting;
using Newtonsoft.Json;

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
        [Ignore]
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
            using (var context = new IsraelHikingDbContext())
            {
                var siteUrlToUpdate = new SiteUrl {Id = id, Title = "title"};
                context.MarkAsModified(siteUrlToUpdate);
                context.SaveChanges();
            }

            using (var context = new IsraelHikingDbContext())
            {
                Assert.IsNotNull(context.SiteUrls.FirstOrDefault(x => x.Title == "title"));
            }
        }

        // HM TODO: use this code to migrate the database - migration was done to routing type and None issue #208.
        [TestMethod]
        [Ignore]
        public void UpdateDatabase()
        {
            using (var context = new IsraelHikingDbContext())
            {
                var list = context.SiteUrls.ToList();
                foreach (var siteUrl in list)
                {
                    //var dataContainerOld = JsonConvert.DeserializeObject<DataContainerOld>(siteUrl.JsonData);
                    var dataContainerOld = JsonConvert.DeserializeObject<DataContainer>(siteUrl.JsonData);
                    if (dataContainerOld.routes.Count == 0)// && dataContainerOld.markers.Count == 0)
                    {
                        continue;
                    }
                    var dataContainerNew = new DataContainer
                    {
                        baseLayer = dataContainerOld.baseLayer,
                        northEast = dataContainerOld.northEast,
                        southWest = dataContainerOld.southWest,
                        overlays = dataContainerOld.overlays,
                        routes = dataContainerOld.routes.Select(old => new RouteData
                        {
                            name = old.name,
                            segments = old.segments
                        }).ToList()
                        
                    };
                    //if (dataContainerOld.markers.Any())
                    //{
                    //    if (!dataContainerNew.routes.Any())
                    //    {
                    //        dataContainerNew.routes.Add(new RouteData { name = "Markers" });
                    //    }
                    //    dataContainerNew.routes.First().markers = dataContainerOld.markers;
                    //}
                    var jsonData = JsonConvert.SerializeObject(dataContainerNew, Formatting.None, new JsonSerializerSettings { NullValueHandling = NullValueHandling.Ignore });
                    siteUrl.JsonData = jsonData;
                    context.MarkAsModified(siteUrl);
                }
                context.SaveChanges();
            }
        }
    }
}
