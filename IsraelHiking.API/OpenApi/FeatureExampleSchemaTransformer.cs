using Microsoft.AspNetCore.OpenApi;
using Microsoft.OpenApi;
using NetTopologySuite.Features;
using NetTopologySuite.Geometries;
using NetTopologySuite.IO.Converters;
using System.Diagnostics.CodeAnalysis;
using System.Text.Json;
using System.Text.Json.Nodes;
using System.Threading;
using System.Threading.Tasks;

namespace IsraelHiking.API.OpenApi;

/// <summary>
/// Provides examples for <see cref="Feature"/> and <see cref="FeatureCollection"/> in the OpenAPI document
/// </summary>
[ExcludeFromCodeCoverage]
public class FeatureExampleSchemaTransformer : IOpenApiSchemaTransformer
{
    /// <inheritdoc/>
    public Task TransformAsync(OpenApiSchema schema, OpenApiSchemaTransformerContext context, CancellationToken cancellationToken)
    {
        var type = context.JsonTypeInfo.Type;
        if (type != typeof(Feature) && type != typeof(FeatureCollection))
        {
            return Task.CompletedTask;
        }
        var options = new JsonSerializerOptions();
        options.Converters.Add(new GeoJsonConverterFactory());
        var feature = new Feature(new LineString([
                new Coordinate(1, 2),
                new Coordinate(3, 4)
            ]),
            new AttributesTable { { "key", "value" } });
        object example = type == typeof(Feature) ? feature : new FeatureCollection { feature };
        var exampleString = JsonSerializer.Serialize(example, options);
        schema.Example = JsonNode.Parse(exampleString);
        schema.Default = JsonNode.Parse(exampleString);
        return Task.CompletedTask;
    }
}
