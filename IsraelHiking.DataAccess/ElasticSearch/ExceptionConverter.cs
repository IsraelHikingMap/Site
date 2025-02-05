using System;
using System.Collections.Generic;
using System.Globalization;
using System.Reflection;
using System.Runtime.Serialization;
using System.Text.Json;
using System.Text.Json.Serialization;

internal class ExceptionConverter : JsonConverter<Exception>
{
    private static List<Dictionary<string, object>> FlattenExceptions(Exception e)
    {
        var maxExceptions = 20;
        var exceptions = new List<Dictionary<string, object>>(maxExceptions);
        var depth = 0;
        do
        {
            var o = ToDictionary(e, depth);
            exceptions.Add(o);
            depth++;
            e = e.InnerException;
        } while (depth < maxExceptions && e != null);

        return exceptions;
    }

    private static Dictionary<string, object> ToDictionary(Exception e, int depth)
    {
        var o = new Dictionary<string, object>(10);
        var si = new SerializationInfo(e.GetType(), new FormatterConverter());
        var sc = new StreamingContext();
        e.GetObjectData(si, sc);

        var helpUrl = si.GetString("HelpURL");
        var stackTrace = si.GetString("StackTraceString");
        var remoteStackTrace = si.GetString("RemoteStackTraceString");
        var remoteStackIndex = si.GetInt32("RemoteStackIndex");
        var exceptionMethod = si.GetString("ExceptionMethod");
        var hresult = si.GetInt32("HResult");
        var source = si.GetString("Source");
        var className = si.GetString("ClassName");

        o.Add("Depth", depth);
        o.Add("ClassName", className);
        o.Add("Message", e.Message);
        o.Add("Source", source);
        o.Add("StackTraceString", stackTrace);
        o.Add("RemoteStackTraceString", remoteStackTrace);
        o.Add("RemoteStackIndex", remoteStackIndex);
        o.Add("HResult", hresult);
        o.Add("HelpURL", helpUrl);

        WriteStructuredExceptionMethod(o, exceptionMethod);
        return o;
    }

    private static void WriteStructuredExceptionMethod(Dictionary<string,object> o, string exceptionMethodString)
    {
        if (string.IsNullOrWhiteSpace(exceptionMethodString)) return;

        var args = exceptionMethodString.Split('\0', '\n');

        if (args.Length != 5) return;

        var memberType = int.Parse(args[0], CultureInfo.InvariantCulture);
        var name = args[1];
        var assemblyName = args[2];
        var className = args[3];
        var signature = args[4];
        var an = new AssemblyName(assemblyName);
        var exceptionMethod = new Dictionary<string, object>(7)
        {
            { "Name", name },
            { "AssemblyName", an.Name },
            { "AssemblyVersion", an.Version.ToString() },
            { "AssemblyCulture", an.CultureName },
            { "ClassName", className },
            { "Signature", signature },
            { "MemberType", memberType }
        };

        o.Add("ExceptionMethod", exceptionMethod);
    }

    public override Exception Read(ref Utf8JsonReader reader, Type typeToConvert, JsonSerializerOptions options) =>
        throw new NotSupportedException();

    public override void Write(Utf8JsonWriter writer, Exception value, JsonSerializerOptions options)
    {
        if (value == null)
        {
            writer.WriteNullValue();
            return;
        }

        var flattenedExceptions = FlattenExceptions(value);
        writer.WriteStartArray();
        for (var i = 0; i < flattenedExceptions.Count; i++)
        {
            var flattenedException = flattenedExceptions[i];
            writer.WriteStartObject();
            foreach (var kv in flattenedException)
            {
                writer.WritePropertyName(kv.Key);
                JsonSerializer.Serialize(writer, kv.Value, options);
            }
            writer.WriteEndObject();
        }
        writer.WriteEndArray();
    }
}