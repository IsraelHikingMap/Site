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
    /// Provides example for feature in swagger API
    /// </summary>
    [ExcludeFromCodeCoverage]
    public class FeatureExampleFilter : ISchemaFilter
    {
        /// <summary>
        /// Applys the example of a <see cref="Feature"/> to the schema
        /// </summary>
        /// <param name="context"></param>
        /// <param name="schema"></param>
        public void Apply(OpenApiSchema schema, SchemaFilterContext context)
        {
            if (context == null)
            {
                return;
            }
            if (context.Type != typeof(Feature))
            {
                return;
            }
            var writer = new GeoJsonWriter
            {
                SerializerSettings = new JsonSerializerSettings { Formatting = Formatting.Indented }
            };
            var exampleFeatureString = writer.Write(
                new Feature(new LineString(new[]
                    {
                        new Coordinate(1, 2),
                        new Coordinate(3, 4),
                    }),
                    new AttributesTable { { "key", "value" } })
            );
            schema.Example = new OpenApiString(exampleFeatureString);
            schema.Default = new OpenApiString(exampleFeatureString);
        }
    }
}