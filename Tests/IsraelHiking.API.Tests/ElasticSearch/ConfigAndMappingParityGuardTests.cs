using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Runtime.CompilerServices;
using System.Text.RegularExpressions;
using Microsoft.VisualStudio.TestTools.UnitTesting;

namespace IsraelHiking.API.Tests.ElasticSearch;

/// <summary>
/// Story 0.7 — static, source-inspection guards for the C# config + Java↔C# mapping-parity invariants.
///
/// These invariants are structural and cross-file (they span vendor/Site, vendor/planet-search and
/// install/compose), so a mocked runtime unit can't exercise them — the honest guard reads the source.
/// Each guard is written so it CAN fail when fed a violation (drop AddEnvironmentVariables, change the
/// port mapping, flip a raw component to indexed, or add a C#-read field missing from both Java models).
///
/// Paths are anchored to this test file's own location via <see cref="CallerFilePathAttribute"/>, so
/// they resolve regardless of the working directory.
/// </summary>
[TestClass]
public class ConfigAndMappingParityGuardTests
{
    // .../vendor/Site/Tests/IsraelHiking.API.Tests/ElasticSearch/<thisFile>
    private static string RepoRoot([CallerFilePath] string thisFilePath = "")
    {
        var dir = Path.GetDirectoryName(thisFilePath)!; // .../ElasticSearch
        // up 5: ElasticSearch -> API.Tests -> Tests -> Site -> vendor -> <repo root>
        return Path.GetFullPath(Path.Combine(dir, "..", "..", "..", "..", ".."));
    }

    /// <summary>
    /// These guards intentionally span the PARENT wrapper repo (vendor/Site + vendor/planet-search +
    /// install/compose). When this test assembly is built/run inside a STANDALONE vendor/Site checkout
    /// (the submodule's own CI, or a bare Site clone), those sibling paths don't exist — so a missing
    /// file means "not in the wrapper layout", which we treat as Inconclusive (skip), NOT a failure.
    /// In the wrapper checkout all files resolve and the guards run for real. (Code-review M1.)
    /// </summary>
    private static string ReadRepoFileOrSkip(params string[] relativeParts)
    {
        var path = Path.Combine(new[] { RepoRoot() }.Concat(relativeParts).ToArray());
        if (!File.Exists(path))
        {
            Assert.Inconclusive(
                $"Cross-repo guard skipped: {path} not found — this looks like a standalone " +
                "vendor/Site checkout, not the parent wrapper repo. Run from the wrapper to enforce it.");
        }
        return File.ReadAllText(path);
    }

    private static string ProgramCs() =>
        ReadRepoFileOrSkip("vendor", "Site", "IsraelHiking.Web", "Program.cs");

    private static string DockerCompose() =>
        ReadRepoFileOrSkip("install", "compose", "docker-compose.yml");

    private static string EsHelperJava() =>
        ReadRepoFileOrSkip("vendor", "planet-search", "src", "main", "java", "il", "org", "osm",
            "israelhiking", "ElasticsearchHelper.java");

    private static string JavaPointDocument() =>
        ReadRepoFileOrSkip("vendor", "planet-search", "src", "main", "java", "il", "org", "osm",
            "israelhiking", "PointDocument.java");

    private static string CsPointDocument() =>
        ReadRepoFileOrSkip("vendor", "Site", "IsraelHiking.DataAccess", "ElasticSearch", "PointDocument.cs");

    // ---- AC1: .NET 9 infra fixes (AR-8) -------------------------------------------------------

    [TestMethod]
    public void Program_CallsAddEnvironmentVariables()
    {
        // Without .AddEnvironmentVariables() the ElasticsearchServerAddress env override from
        // docker-compose is silently ignored and the backend talks to the appsettings default.
        Assert.IsTrue(Regex.IsMatch(ProgramCs(), @"\.AddEnvironmentVariables\s*\("),
            "Program.cs no longer calls .AddEnvironmentVariables() — the ES address env override " +
            "(ElasticsearchServerAddress in docker-compose) would be silently ignored (AR-8).");
    }

    [TestMethod]
    public void Compose_MapsSiteHost5001ToContainer8080()
    {
        // .NET 9 images listen on :8080 (ASPNETCORE_HTTP_PORTS=8080); the host must reach the API
        // on :5001 (what `make search` curls). The binding contract is the 5001:8080 mapping.
        Assert.IsTrue(Regex.IsMatch(DockerCompose(), "\"5001:8080\""),
            "install/compose/docker-compose.yml no longer maps host 5001 -> container 8080 for the " +
            "site service. `make search` reaches the API via :5001 -> :8080 (AR-8).");
    }

    // ---- AC2: Java↔C# mapping parity (NFR-7) --------------------------------------------------

    /// <summary>The ES `_source` field names the C# query-time read model binds to (its JsonPropertyName values).</summary>
    private static List<string> CsReadFieldNames()
    {
        var matches = Regex.Matches(CsPointDocument(), @"\[JsonPropertyName\(""([^""]+)""\)\]");
        return matches.Select(m => m.Groups[1].Value).ToList();
    }

    [TestMethod]
    public void EveryCsReadField_ExistsInAJavaModel()
    {
        // Parity (NFR-7): every field READ at query time by C# must exist on the Java side — either in
        // the explicit ES mapping (queryable hot-path fields) or written to _source by the Java write
        // model (PointDocument.java). A C#-read field absent from BOTH = a field that can only ever be
        // null at query time = a real parity break.
        var csFields = CsReadFieldNames();
        Assert.IsTrue(csFields.Count > 0, "Could not parse any [JsonPropertyName] from the C# PointDocument.");

        var javaSource = JavaPointDocument();
        var esMapping = EsHelperJava();

        var missing = new List<string>();
        foreach (var field in csFields)
        {
            // Java write model declares a public field with this exact name, OR the ES mapping declares
            // a property with this name (also matches the dotted "name.<lang>" via the "name" base).
            var inJavaModel = Regex.IsMatch(javaSource, $@"\bpublic\b[^\n;]*\b{Regex.Escape(field)}\b\s*[;=]");
            var inEsMapping = esMapping.Contains($"\"{field}\"") || esMapping.Contains($"\"{field}.");
            if (!inJavaModel && !inEsMapping)
            {
                missing.Add(field);
            }
        }

        Assert.AreEqual(0, missing.Count,
            "C# query-time PointDocument reads field(s) that exist on neither the Java write model nor " +
            "the ES mapping — parity break (NFR-7): " + string.Join(", ", missing) +
            ". Add the field to ElasticsearchHelper.java mapping and/or PointDocument.java.");
    }

    [TestMethod]
    public void HotPathQueryFields_ExistInTheEsMapping()
    {
        // The fields C# actually drives ranking with (text match + field_value_factor) must be in the
        // explicit ES mapping so they're queryable: name.<lang>, location, prominence.
        var esMapping = EsHelperJava();
        Assert.IsTrue(Regex.IsMatch(esMapping, "\"name\\.\""),
            "ES mapping no longer declares the per-language name.<lang> text fields (NFR-7).");
        Assert.IsTrue(esMapping.Contains("\"location\""),
            "ES mapping no longer declares the geo_point 'location' field (NFR-7).");
        Assert.IsTrue(esMapping.Contains("\"prominence\""),
            "ES mapping no longer declares the 'prominence' field used by field_value_factor (NFR-7).");
    }

    [TestMethod]
    public void RawComponents_AreIndexFalse_AndHotFields_AreIndexed()
    {
        // Raw/debug components stay index:false (debuggable, not searchable); the hot-path searchable
        // fields (prominence, population) must NOT be index:false. Flipping either way fails the guard.
        var esMapping = EsHelperJava();

        string[] rawComponents = { "prom_base", "prom_qrank_norm", "prom_meta", "ele_norm", "qrank_raw" };
        foreach (var raw in rawComponents)
        {
            // e.g.  m.properties("prom_base", n -> n.float_(f -> f.index(false)));
            var declaredIndexFalse = Regex.IsMatch(esMapping,
                $@"""{Regex.Escape(raw)}""[^;]*\.index\(\s*false\s*\)");
            Assert.IsTrue(declaredIndexFalse,
                $"Raw component '{raw}' must be mapped with .index(false) (re-tunable, not searchable) " +
                "— it is missing or was flipped to indexed (NFR-7).");
        }

        // prominence/population are searchable hot-path fields: they must NOT be declared index:false.
        foreach (var hot in new[] { "prominence", "population" })
        {
            var declaredIndexFalse = Regex.IsMatch(esMapping,
                $@"""{Regex.Escape(hot)}""[^;]*\.index\(\s*false\s*\)");
            Assert.IsFalse(declaredIndexFalse,
                $"'{hot}' was flipped to .index(false) — it must stay indexed/searchable (NFR-7).");
        }
    }

    [TestMethod]
    public void RankingAndRawFields_UseSnakeCase()
    {
        // The ranking/raw component fields this engagement added are snake_case in ES. (Pre-existing
        // camelCase poi* fields are out of scope — do not force-rename them.)
        var esMapping = EsHelperJava();
        string[] snakeCaseFields = { "prom_base", "prom_qrank_norm", "prom_meta", "ele_norm", "qrank_raw" };
        foreach (var field in snakeCaseFields)
        {
            Assert.IsTrue(esMapping.Contains($"\"{field}\""),
                $"Expected snake_case ranking/raw field '{field}' in the ES mapping (NFR-7).");
            // sanity: the snake_case name has no uppercase letters
            Assert.IsFalse(Regex.IsMatch(field, "[A-Z]"), $"'{field}' should be snake_case.");
        }
    }
}
