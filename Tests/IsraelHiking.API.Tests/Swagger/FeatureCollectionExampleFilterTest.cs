using System;
using IsraelHiking.API.Swagger;
using Microsoft.VisualStudio.TestTools.UnitTesting;
using NetTopologySuite.Features;
using Swashbuckle.Swagger;

namespace IsraelHiking.API.Tests.Swagger
{
    [TestClass]
    public class FeatureCollectionExampleFilterTest
    {
        [TestMethod]
        public void CreateExmpleFeatureCollection_NonFeatureCollectionType_NotDoAnyThing()
        {
            var filter = new FeatureCollectionExampleFilter();

            var schema = new Schema();
            filter.Apply(schema, null, typeof(int));

            Assert.AreEqual(null, schema.example);
        }

        [TestMethod]
        public void CreateExmpleFeatureCollection_FeatureCollectionType_UpdateExample()
        {
            var filter = new FeatureCollectionExampleFilter();

            var schema = new Schema();
            filter.Apply(schema, null, typeof(FeatureCollection));

            Assert.AreNotEqual(null, schema.example);
        }
    }
}
