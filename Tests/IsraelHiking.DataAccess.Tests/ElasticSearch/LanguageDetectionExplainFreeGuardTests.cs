using System.IO;
using System.Runtime.CompilerServices;
using System.Text.RegularExpressions;
using Microsoft.VisualStudio.TestTools.UnitTesting;

namespace IsraelHiking.DataAccess.Tests.ElasticSearch;

[TestClass]
public class LanguageDetectionExplainFreeGuardTests
{
    private static string GatewaySourcePath([CallerFilePath] string thisFilePath = "")
    {
        var testDir = Path.GetDirectoryName(thisFilePath)!;
        var siteRoot = Path.GetFullPath(Path.Combine(testDir, "..", "..", ".."));
        return Path.Combine(siteRoot,
            "IsraelHiking.DataAccess", "ElasticSearch", "ElasticSearchGateway.cs");
    }

    private static string ReadGatewaySource()
    {
        var path = GatewaySourcePath();
        if (!File.Exists(path))
        {
            Assert.Inconclusive(
                $"Gateway source not found at {path} — the test assembly is running without the " +
                "source tree, so the source-shape guard is skipped.");
        }
        return File.ReadAllText(path);
    }

    private static string StripCommentsAndLiterals(string source)
    {
        var noBlock = Regex.Replace(source, @"/\*.*?\*/", " ", RegexOptions.Singleline);
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

        var forbidden = Regex.Match(code, @"\.Explain\s*\(");

        Assert.IsFalse(forbidden.Success,
            "ElasticSearchGateway has a '.Explain(' call. Language detection must use named queries " +
            "(MatchedQueries), not the Lucene explain tree.");
    }

    [TestMethod]
    public void Gateway_StillNamesPerLanguageClauses()
    {
        var code = StripCommentsAndLiterals(ReadGatewaySource());

        Assert.IsTrue(Regex.IsMatch(code, @"\.Name\s*\(\s*(SearchLanguageDetector\s*\.\s*)?LanguageQueryName\("),
            "ElasticSearchGateway no longer names the per-language phrase clauses with " +
            "LanguageQueryName(...). MatchedQueries-based detection needs those names .");
    }

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
        Assert.IsFalse(HasLiveExplain("var s = \".Explain(\"; var y = 2;"));
    }

    [TestMethod]
    public void Stripper_StillCatchesLiveExplainAfterAUrlLiteral()
    {
        Assert.IsTrue(HasLiveExplain("var u = \"http://es:9200\"; resp = client.Search(s => s.Explain());"));
    }

    [TestMethod]
    public void Stripper_CatchesAPlainLiveExplainCall()
    {
        Assert.IsTrue(HasLiveExplain("resp = client.Search(s => s.Index(\"x\").Explain());"));
    }
}
