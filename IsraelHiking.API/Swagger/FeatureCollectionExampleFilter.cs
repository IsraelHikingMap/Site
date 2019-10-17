using Microsoft.OpenApi.Any;
using Microsoft.OpenApi.Models;
using NetTopologySuite.Features;
using NetTopologySuite.Geometries;
using NetTopologySuite.IO;
using Newtonsoft.Json;
using Swashbuckle.AspNetCore.SwaggerGen;
using System.Diagnostics.CodeAnalysis;

namespace IsraelHiking.API.Swagger
{
    /// <summary>
    /// Provides example for feature collection in swagger API
    /// </summary>
    [ExcludeFromCodeCoverage]
    public class FeatureCollectionExampleFilter : ISchemaFilter
    {
        /// <summary>
        /// Applys the example of a <see cref="FeatureCollection"/> to the schema
        /// </summary>
        /// <param name="context"></param>
        /// <param name="schema"></param>
        public void Apply(OpenApiSchema schema, SchemaFilterContext context)
        {
            if (context == null)
            {
                return;
            }
            if (context.ApiModel.Type != typeof(FeatureCollection))
            {
                return;
            }
            var writer = new GeoJsonWriter
            {
                SerializerSettings = new JsonSerializerSettings { Formatting = Formatting.Indented }
            };
            var exampleFeatureCollectionString = writer.Write(
                new FeatureCollection
                {
                    new Feature(new LineString(new[]
                        {
                            new Coordinate(1, 2),
                            new Coordinate(3, 4),
                        }),
                        new AttributesTable { {"key", "value" } })
                });
            schema.Example = new OpenApiString(exampleFeatureCollectionString);
            schema.Default = new OpenApiString(exampleFeatureCollectionString);
        }
    }
}