using Microsoft.OpenApi;
using NetTopologySuite.Features;
using NetTopologySuite.Geometries;
using Swashbuckle.AspNetCore.SwaggerGen;
using System.Diagnostics.CodeAnalysis;
using System.Text.Json;
using System.Text.Json.Nodes;
using NetTopologySuite.IO.Converters;

namespace IsraelHiking.API.Swagger;

/// <summary>
/// Provides example for feature collection in swagger API
/// </summary>
[ExcludeFromCodeCoverage]
public class FeatureCollectionExampleFilter : ISchemaFilter
{
    /// <summary>
    /// Apples the example of a <see cref="FeatureCollection"/> to the schema
    /// </summary>
    /// <param name="context"></param>
    /// <param name="schema"></param>
    public void Apply(IOpenApiSchema schema, SchemaFilterContext context)
    {
        if (context?.Type != typeof(FeatureCollection))
        {
            return;
        }
        if (schema is not OpenApiSchema concreteSchema)
        {
            return;
        }
        var options = new JsonSerializerOptions();
        options.Converters.Add(new GeoJsonConverterFactory());
        var exampleFeatureCollectionString = JsonSerializer.Serialize(
            new FeatureCollection
            {
                new Feature(new LineString([
                        new Coordinate(1, 2),
                        new Coordinate(3, 4)
                    ]),
                    new AttributesTable { {"key", "value" } })
            }, options);
        concreteSchema.Example = JsonNode.Parse(exampleFeatureCollectionString);
        concreteSchema.Default = JsonNode.Parse(exampleFeatureCollectionString);
    }
}
