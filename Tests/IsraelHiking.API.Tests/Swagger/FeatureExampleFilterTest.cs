using IsraelHiking.API.Swagger;
using Microsoft.VisualStudio.TestTools.UnitTesting;
using NetTopologySuite.Features;
using Swashbuckle.Swagger;

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
            filter.Apply(schema, null, typeof(int));

            Assert.AreEqual(null, schema.example);
        }

        [TestMethod]
        public void CreateExmpleFeature_FeatureType_UpdateExample()
        {
            var filter = new FeatureExampleFilter();

            var schema = new Schema();
            filter.Apply(schema, null, typeof(Feature));

            Assert.AreNotEqual(null, schema.example);
        }
    }
}
