using IsraelHiking.API.Swagger;
using Microsoft.VisualStudio.TestTools.UnitTesting;
using NetTopologySuite.Features;
using Swashbuckle.AspNetCore.Swagger;

namespace IsraelHiking.API.Tests.Swagger
{
    [TestClass]
    public class FeatureExampleFilterTest
    {
        [TestMethod]
        public void CreateExmpleFeature_NonFeatureType_NotDoAnyThing()
        {
            var filter = new FeatureExampleFilter();

            var schema = new Schema();
            filter.Apply(schema, null);

            Assert.AreEqual(null, schema.Example);
        }

        [TestMethod]
        public void CreateExmpleFeature_FeatureType_UpdateExample()
        {
            var filter = new FeatureExampleFilter();

            var schema = new Schema();
            filter.Apply(schema, null);

            Assert.AreNotEqual(null, schema.Example);
        }
    }
}
