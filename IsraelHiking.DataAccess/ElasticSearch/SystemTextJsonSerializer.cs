using System;
using System.Collections.Generic;
using System.IO;
using System.Text.Json;
using System.Text.Json.Serialization;
using System.Threading;
using System.Threading.Tasks;
using Elasticsearch.Net;
using IsraelHiking.Common.Extensions;

public class SystemTextJsonSerializer : IElasticsearchSerializer
{
    private readonly Lazy<JsonSerializerOptions> _indented;
    private readonly Lazy<JsonSerializerOptions> _none;

    private IList<JsonConverter> BakedInConverters { get; } = new List<JsonConverter>
    {
        {new DynamicDictionaryConverter()},
        {new DateTimeConverter()}
    };

    public SystemTextJsonSerializer(JsonConverterFactory factory)
    {
        var indentedOptions = new JsonSerializerOptions
        {
            DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull,
            WriteIndented = true
        };
        indentedOptions.Converters.Add(factory);
        foreach (var converter in BakedInConverters)
            indentedOptions.Converters.Add(converter);
        var noneIndentedOptions = new JsonSerializerOptions
        {
            DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull,
            WriteIndented = false
        };
        noneIndentedOptions.Converters.Add(factory);
        foreach (var converter in BakedInConverters)
            noneIndentedOptions.Converters.Add(converter);
        _indented = new Lazy<JsonSerializerOptions>(() => indentedOptions);
        _none = new Lazy<JsonSerializerOptions>(() => noneIndentedOptions);
    }

    private static bool TryReturnDefault<T>(Stream stream, out T deserialize)
    {
        deserialize = default;
        return stream == null || stream == Stream.Null || (stream.CanSeek && stream.Length == 0);
    }

    private static MemoryStream ToMemoryStream(Stream stream)
    {
        if (stream is MemoryStream m) return m;
        var length = stream.CanSeek ? stream.Length : (long?) null;
        var wrapped = length.HasValue ? new MemoryStream(new byte[length.Value]) : new MemoryStream();
        stream.CopyTo(wrapped);
        return wrapped;
    }

    private static ReadOnlySpan<byte> ToReadOnlySpan(Stream stream)
    {
        using var m = ToMemoryStream(stream);

        if (m.TryGetBuffer(out var segment))
            return segment;

        var a = m.ToArray();
        return new ReadOnlySpan<byte>(a).Slice(0, a.Length);
    }

    private JsonSerializerOptions GetFormatting(SerializationFormatting formatting) =>
        formatting == SerializationFormatting.None ? _none.Value : _indented.Value;

    public object Deserialize(Type type, Stream stream)
    {
        if (TryReturnDefault(stream, out object deserialize)) return deserialize;

        var buffered = ToReadOnlySpan(stream);
        return JsonSerializer.Deserialize(buffered, type, _none.Value);
    }

    public T Deserialize<T>(Stream stream)
    {
        if (TryReturnDefault(stream, out T deserialize)) return deserialize;

        var buffered = ToReadOnlySpan(stream);
        return JsonSerializer.Deserialize<T>(buffered, _none.Value);
    }

    public void Serialize<T>(T data, Stream stream, SerializationFormatting formatting = SerializationFormatting.None)
    {
        using var writer = new Utf8JsonWriter(stream);
        if (data == null)
            JsonSerializer.Serialize(writer, null, typeof(object), GetFormatting(formatting));
        else
            JsonSerializer.Serialize(writer, data, data.GetType(), GetFormatting(formatting));
    }

    public async Task SerializeAsync<T>(T data, Stream stream,
        SerializationFormatting formatting = SerializationFormatting.None,
        CancellationToken cancellationToken = default
    )
    {
        if (data == null)
            await JsonSerializer
                .SerializeAsync(stream, null, typeof(object), GetFormatting(formatting), cancellationToken)
                .ConfigureAwait(false);
        else
            await JsonSerializer
                .SerializeAsync(stream, data, data.GetType(), GetFormatting(formatting), cancellationToken)
                .ConfigureAwait(false);
    }

    public Task<object> DeserializeAsync(Type type, Stream stream, CancellationToken cancellationToken = default)
    {
        if (TryReturnDefault(stream, out object deserialize)) return Task.FromResult(deserialize);

        return JsonSerializer.DeserializeAsync(stream, type, _none.Value, cancellationToken).AsTask();
    }

    public Task<T> DeserializeAsync<T>(Stream stream, CancellationToken cancellationToken = default)
    {
        if (TryReturnDefault(stream, out T deserialize)) return Task.FromResult(deserialize);

        return JsonSerializer.DeserializeAsync<T>(stream, _none.Value, cancellationToken).AsTask();
    }
}