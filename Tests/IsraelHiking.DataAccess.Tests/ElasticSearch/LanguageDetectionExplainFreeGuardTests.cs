using System.IO;
using System.Runtime.CompilerServices;
using System.Text.RegularExpressions;
using Microsoft.VisualStudio.TestTools.UnitTesting;

namespace IsraelHiking.DataAccess.Tests.ElasticSearch;

/// <summary>
/// Story 0.6 AC1 (FR-5.1) — static, source-inspection guard for the explain-tree-free invariant.
///
/// The live <c>Search*</c> gateway tests are <c>[Ignore]</c>d (they need a real cluster), so the
/// binding guard against reintroducing the OLD explain-based language detection is a source check:
/// the gateway must contain NO live <c>.Explain(</c> call, AND must keep NAMING the per-language
/// phrase clauses (so <c>MatchedQueries</c> can carry the language signal). A guard that only checked
/// "no Explain" would pass a broken build that dropped the names; a guard that only checked names
/// would pass a build that re-added <c>.Explain(</c>. Both halves are asserted.
///
/// We read the SOURCE (not the compiled assembly) because the invariant is "the code does not use
/// the explain tree", which is a source-shape fact. The path is anchored to this test file's own
/// location via <see cref="CallerFilePathAttribute"/>, so it resolves regardless of CWD.
/// </summary>
[TestClass]
public class LanguageDetectionExplainFreeGuardTests
{
    // .../Tests/IsraelHiking.DataAccess.Tests/ElasticSearch/<thisFile>
    //   -> up 3 to vendor/Site, then into the production gateway source.
    private static string GatewaySourcePath([CallerFilePath] string thisFilePath = "")
    {
        var testDir = Path.GetDirectoryName(thisFilePath)!;                 // .../ElasticSearch
        var siteRoot = Path.GetFullPath(Path.Combine(testDir, "..", "..", "..")); // .../vendor/Site
        return Path.Combine(siteRoot,
            "IsraelHiking.DataAccess", "ElasticSearch", "ElasticSearchGateway.cs");
    }

    private static string ReadGatewaySource()
    {
        var path = GatewaySourcePath();
        Assert.IsTrue(File.Exists(path),
            $"Could not locate the gateway source for the explain-tree-free guard at: {path}");
        return File.ReadAllText(path);
    }

    /// <summary>
    /// Reduce the source to "live code only" so neither a doc-comment word "explain"/"explanation"
    /// NOR a string literal can fool the `.Explain(` check. Order matters (code-review M2):
    ///   1. block comments  (could contain `"` or `//` that would desync the later passes)
    ///   2. string + char literals  (so a URL like "http://x" can't truncate the line at `//`,
    ///      and a literal containing ".Explain(" can't false-positive)
    ///   3. line comments  (now safe — no `//` survives inside a literal)
    /// This is a heuristic lexer, not a full C# parser, but it removes the two ways the brief flagged
    /// the guard could be fooled.
    /// </summary>
    private static string StripCommentsAndLiterals(string source)
    {
        var noBlock = Regex.Replace(source, @"/\*.*?\*/", " ", RegexOptions.Singleline);
        // Verbatim + regular strings and char literals (handles escaped quotes \" and "").
        var noVerbatim = Regex.Replace(noBlock, "@\"(?:[^\"]|\"\")*\"", "\"\"");
        var noStrings = Regex.Replace(noVerbatim, "\"(?:\\\\.|[^\"\\\\])*\"", "\"\"");
        var noChars = Regex.Replace(noStrings, @"'(?:\\.|[^'\\])'", "' '");
        var noLine = Regex.Replace(noChars, @"//[^\n]*", " ");
        return noLine;
    }

    [TestMethod]
    public void Gateway_HasNoExplainBasedLanguageDetection()
    {
        var code = StripCommentsAndLiterals(ReadGatewaySource());

        // The ONLY permitted .Explain(...) is the DEBUG_SEARCH-gated debug-harness call
        // `.Explain(DebugSearch)` (ADR-0003 / F10 score-breakdown — off on production, no explain cost).
        // ANYTHING else — `.Explain()`, `.Explain(true)`, `.Explain(someOtherFlag)` — is the OLD,
        // function_score-fragile language-detection path and is forbidden: function_score reshapes the
        // explain tree and silently breaks it (FR-5.1). Match every .Explain( whose argument is NOT
        // exactly `DebugSearch`, and assert there are none.
        var forbidden = Regex.Match(code, @"\.Explain\s*\(\s*(?!DebugSearch\s*\))[^)]*\)");

        Assert.IsFalse(forbidden.Success,
            "ElasticSearchGateway has a forbidden '.Explain(' call: '" + forbidden.Value + "'. " +
            "Language detection must use named queries (MatchedQueries), not the Lucene explain tree. " +
            "The only allowed call is the DEBUG_SEARCH-gated '.Explain(DebugSearch)' (ADR-0003). " +
            "See docs/adr/0001-... build-vs-query split.");
    }

    [TestMethod]
    public void Gateway_StillNamesPerLanguageClauses()
    {
        var code = StripCommentsAndLiterals(ReadGatewaySource());

        // The positive mechanism must remain: per-language clauses are named via LanguageQueryName,
        // so the language can be recovered from hit.MatchedQueries. Without this, "no Explain" alone
        // would pass a build that dropped the signal entirely.
        Assert.IsTrue(Regex.IsMatch(code, @"\.Name\s*\(\s*LanguageQueryName\("),
            "ElasticSearchGateway no longer names the per-language phrase clauses with " +
            "LanguageQueryName(...). MatchedQueries-based detection needs those names (FR-5.1).");
    }

    // ---- Regression tests for the stripper itself (code-review M2) ---------------------------

    private static bool HasLiveExplain(string code) =>
        Regex.IsMatch(StripCommentsAndLiterals(code), @"\.Explain\s*\(");

    [TestMethod]
    public void Stripper_IgnoresExplainInDocComments()
    {
        Assert.IsFalse(HasLiveExplain("/// It uses the explanation object.\n var x = 1;"));
        Assert.IsFalse(HasLiveExplain("/* parses the .Explain( tree */ var x = 1;"));
    }

    [TestMethod]
    public void Stripper_IgnoresExplainInsideStringLiterals()
    {
        // A literal that contains ".Explain(" must NOT be read as a live call.
        Assert.IsFalse(HasLiveExplain("var s = \".Explain(\"; var y = 2;"));
    }

    [TestMethod]
    public void Stripper_StillCatchesLiveExplainAfterAUrlLiteral()
    {
        // The M2 failure mode: a URL string literal containing "//" must not truncate the line and
        // hide a real .Explain() call that follows it on the same statement.
        Assert.IsTrue(HasLiveExplain("var u = \"http://es:9200\"; resp = client.Search(s => s.Explain());"));
    }

    [TestMethod]
    public void Stripper_CatchesAPlainLiveExplainCall()
    {
        Assert.IsTrue(HasLiveExplain("resp = client.Search(s => s.Index(\"x\").Explain());"));
    }

    // ---- Regression tests for the DebugSearch-gated allowance -------------------------------------

    private static bool HasForbiddenExplain(string code) =>
        Regex.IsMatch(StripCommentsAndLiterals(code),
            @"\.Explain\s*\(\s*(?!DebugSearch\s*\))[^)]*\)");

    [TestMethod]
    public void ExplainGuard_AllowsTheDebugSearchGatedCall()
    {
        // The DEBUG_SEARCH debug-harness call is the one permitted .Explain — it must NOT trip the guard.
        Assert.IsFalse(HasForbiddenExplain("resp = client.Search(s => s.Explain(DebugSearch));"));
    }

    [TestMethod]
    public void ExplainGuard_CatchesUnconditionalAndOtherFlagExplain()
    {
        // Anything other than .Explain(DebugSearch) is the forbidden language-detection path.
        Assert.IsTrue(HasForbiddenExplain("resp = client.Search(s => s.Explain());"));
        Assert.IsTrue(HasForbiddenExplain("resp = client.Search(s => s.Explain(true));"));
        Assert.IsTrue(HasForbiddenExplain("resp = client.Search(s => s.Explain(someOtherFlag));"));
    }
}
