using Microsoft.OpenApi.Any;
using Microsoft.OpenApi.Models;
using NetTopologySuite.Features;
using NetTopologySuite.Geometries;
using Swashbuckle.AspNetCore.SwaggerGen;
using System.Diagnostics.CodeAnalysis;
using System.Text.Json;
using NetTopologySuite.IO.Converters;

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
            var options = new JsonSerializerOptions();
            options.Converters.Add(new GeoJsonConverterFactory());
            var exampleFeatureString = JsonSerializer.Serialize(
                new Feature(new LineString(new[]
                    {
                        new Coordinate(1, 2),
                        new Coordinate(3, 4),
                    }),
                    new AttributesTable { { "key", "value" } })
            , options);
            schema.Example = new OpenApiString(exampleFeatureString);
            schema.Default = new OpenApiString(exampleFeatureString);
        }
    }
}