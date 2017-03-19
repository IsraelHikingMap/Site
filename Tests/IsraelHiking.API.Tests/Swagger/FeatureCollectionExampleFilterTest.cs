using IsraelHiking.API.Swagger;
using Microsoft.VisualStudio.TestTools.UnitTesting;
using NetTopologySuite.Features;
using Swashbuckle.AspNetCore.Swagger;

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
            filter.Apply(schema, null);

            Assert.AreEqual(null, schema.Example);
        }

        [TestMethod]
        public void CreateExmpleFeatureCollection_FeatureCollectionType_UpdateExample()
        {
            var filter = new FeatureCollectionExampleFilter();

            var schema = new Schema();
            filter.Apply(schema, new Swashbuckle.AspNetCore.SwaggerGen.SchemaFilterContext(typeof(FeatureCollection), null, null));

            Assert.AreNotEqual(null, schema.Example);
        }
    }
}
