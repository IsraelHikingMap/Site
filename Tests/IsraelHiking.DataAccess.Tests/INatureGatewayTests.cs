using System;
using System.Collections.Generic;
using System.Collections.ObjectModel;
using System.IO;
using System.Linq;
using System.Text;
using Microsoft.VisualStudio.TestTools.UnitTesting;
using NetTopologySuite.Features;
using NetTopologySuite.IO;
using Newtonsoft.Json;

namespace IsraelHiking.DataAccess.Tests
{
    [TestClass]
    public class INatureGatewayTests
    {
        [TestMethod]
        [Ignore]
        public void GetAllPages()
        {
            var wikiGateway = new INatureGateway(new TraceLogger());
            wikiGateway.Initialize().Wait();
            var results = wikiGateway.GetAll().Result;
            Assert.IsTrue(results.Count > 0);
            var writer = new GeoJsonWriter {SerializerSettings = new JsonSerializerSettings { Formatting = Formatting.Indented }};
            var collection = new FeatureCollection(new Collection<IFeature>(results.Cast<IFeature>().ToArray()));
            File.WriteAllText(@"D:\iNature.geojson", writer.Write(collection));
        }
    }
}
