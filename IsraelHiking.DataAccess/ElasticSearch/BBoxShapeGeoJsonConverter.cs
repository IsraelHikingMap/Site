using System;
using System.Text.Json;
using System.Text.Json.Serialization;

namespace IsraelHiking.DataAccess.ElasticSearch;

public class BBoxShapeGeoJsonConverter : JsonConverter<BaseBBoxShape> {
    public override BaseBBoxShape Read(ref Utf8JsonReader reader, Type typeToConvert, JsonSerializerOptions options)
    {
        using JsonDocument document = JsonDocument.ParseValue(ref reader);
        if (!document.RootElement.TryGetProperty("type", out var typeProperty))
        {
            throw new JsonException("Unable to determine GeoShape type.");
        }
        var type = typeProperty.GetString();

        // Use a switch for cleaner logic
        return type switch
        {
            "envelope" => JsonSerializer.Deserialize<EnvelopeBBoxShape>(document.RootElement.ToString(), options),
            "polygon" => JsonSerializer.Deserialize<PolygonBBoxShape>(document.RootElement.ToString(), options),
            "multipolygon" => JsonSerializer.Deserialize<MultiPolygonBBoxShape>(document.RootElement.ToString(), options),
            _ => throw new JsonException($"Unknown GeoShape type: {type}") // Handle unknown types
        };
    }

    public override void Write(Utf8JsonWriter writer, BaseBBoxShape value, JsonSerializerOptions options)
    {
        JsonSerializer.Serialize(writer, value, value.GetType(), options);
    }
}