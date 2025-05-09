using System;
using System.Text.Json;
using System.Text.Json.Serialization;

namespace IsraelHiking.Common.Extensions;

/// <summary>
/// This converter is used to be able to better parse date time object and write them in universal time
/// </summary>
public class DateTimeConverter : JsonConverter<DateTime>
{
    public override DateTime Read(ref Utf8JsonReader reader, Type typeToConvert, JsonSerializerOptions options)
    {
        return DateTime.Parse(reader.GetString() ?? string.Empty);
    }

    public override void Write(Utf8JsonWriter writer, DateTime value, JsonSerializerOptions options)
    {
        writer.WriteStringValue(value.ToUniversalTime());
    }
}