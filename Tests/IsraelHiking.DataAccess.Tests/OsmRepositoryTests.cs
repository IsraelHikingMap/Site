using System.Collections.Generic;
using System.IO;
using Microsoft.Extensions.Logging;
using Microsoft.VisualStudio.TestTools.UnitTesting;
using NSubstitute;

namespace IsraelHiking.DataAccess.Tests;

[TestClass]
public class OsmRepositoryTests
{
    [TestMethod]
    [Ignore]
    public void TestGetExternalReferences()
    {
        var osmRepository = new OsmRepository(Substitute.For<ILogger>());
        var stream = new FileStream("/Users/harel/Downloads/israel-and-palestine-latest.osm.pbf", FileMode.Open);
        var result = osmRepository.GetExternalReferences(stream).Result;
        Assert.IsTrue(result.Count > 0);
    }
        
}