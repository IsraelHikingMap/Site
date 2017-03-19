using GeoAPI.Geometries;
using NetTopologySuite.Features;
using NetTopologySuite.Geometries;
using Newtonsoft.Json;
using Swashbuckle.AspNetCore.SwaggerGen;
using Swashbuckle.AspNetCore.Swagger;
using NetTopologySuite.IO;

namespace IsraelHiking.API.Swagger
{
    /// <summary>
    /// Provides example for feature in swagger API
    /// </summary>
    public class FeatureExampleFilter : ISchemaFilter
    {
        public void Apply(Schema model, SchemaFilterContext context)
        {
            if (context == null)
            {
                return;
            }
            if (context.SystemType != typeof(Feature))
            {
                return;
            }
            var writer = new GeoJsonWriter();
            var exampleFeatureString = writer.Write(
                new Feature(new LineString(new[]
                    {
                        new Coordinate(1, 2),
                        new Coordinate(3, 4),
                    }),
                    new AttributesTable())
            );
            model.Example = JsonConvert.DeserializeObject(exampleFeatureString);
            model.Default = JsonConvert.DeserializeObject(exampleFeatureString);
        }
    }
}