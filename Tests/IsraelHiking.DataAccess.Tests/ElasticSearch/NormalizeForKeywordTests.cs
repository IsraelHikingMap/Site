using System.Collections.Generic;
using System.IO;
using Microsoft.VisualStudio.TestTools.UnitTesting;
using IsraelHiking.DataAccess.ElasticSearch;
using YamlDotNet.Serialization;
using YamlDotNet.Serialization.NamingConventions;

namespace IsraelHiking.DataAccess.Tests.ElasticSearch;

/// <summary>
/// Guards the exact-name floor's query_norm (ADR-0026). The painless floor compares a query string
/// against the STORED name.&lt;l&gt;.keyword value; that value is normalized at index time by the
/// PlanetSearch indexer (ElasticsearchHelper.java):
///   universal_normalizer (non-he): hebrew_niqqud (strip U+05B0-U+05C7) -> asciifolding -> lowercase
///   hebrew_normalizer    (he):     hebrew_niqqud -> matres(וו->ו) -> matres_yod(יי->י) -> asciifolding -> lowercase
/// ElasticSearchGateway.NormalizeForKeyword MUST reproduce each chain exactly, or an exact match
/// silently never matches (trap #2 — Hebrew false-green: the English rows recover while the Hebrew
/// X001 IBT case does not). These tests pin the per-field behavior against INDEPENDENTLY-derived
/// expected values (the documented chain applied by hand), not the implementation's own output.
/// </summary>
[TestClass]
public class NormalizeForKeywordTests
{
    // ---- base form (universal_normalizer: non-he fields) ----

    [TestMethod]
    public void Base_FoldsLatinAccentsAndLowercases()
    {
        // "Café" -> niqqud-strip (no-op) -> asciifolding (é->e) -> lowercase -> "cafe".
        Assert.AreEqual("cafe", ElasticSearchGateway.NormalizeForKeyword("Café", isHebrew: false));
    }

    [TestMethod]
    public void Base_LowercasesAsciiName()
    {
        Assert.AreEqual("eagle spring", ElasticSearchGateway.NormalizeForKeyword("Eagle Spring", isHebrew: false));
    }

    [TestMethod]
    public void Base_DoesNotFoldHebrewMatres()
    {
        // The universal chain has NO matres fold, so a doubled vav/yod survives on a non-he field.
        Assert.AreEqual("דוויד", ElasticSearchGateway.NormalizeForKeyword("דוויד", isHebrew: false));
    }

    // ---- he form (hebrew_normalizer: name.he.keyword) ----

    [TestMethod]
    public void He_CollapsesDoubledVav()
    {
        // matres: וו -> ו (doubled-only). "דוויד" (doubled vav) -> "דויד".
        Assert.AreEqual("דויד", ElasticSearchGateway.NormalizeForKeyword("דוויד", isHebrew: true));
    }

    [TestMethod]
    public void He_CollapsesDoubledYod()
    {
        // matres_yod: יי -> י (doubled-only). "אייל" (doubled yod) -> "איל".
        Assert.AreEqual("איל", ElasticSearchGateway.NormalizeForKeyword("אייל", isHebrew: true));
    }

    [TestMethod]
    public void He_LeavesSingleInteriorVavAndYodIntact()
    {
        // DOUBLED-only rule: a single interior vav/yod is NEVER dropped (ADR-0011 deferred the
        // fuller rule for client sign-off — it would merge ~7 homographs). "אור" stays "אור".
        Assert.AreEqual("אור", ElasticSearchGateway.NormalizeForKeyword("אור", isHebrew: true));
        Assert.AreEqual("דוד", ElasticSearchGateway.NormalizeForKeyword("דוד", isHebrew: true));
    }

    [TestMethod]
    public void He_StripsNiqqud()
    {
        // hebrew_niqqud strips U+05B0-U+05C7. "שָׁלוֹם" (with niqqud) -> "שלום".
        Assert.AreEqual("שלום", ElasticSearchGateway.NormalizeForKeyword("שָׁלוֹם", isHebrew: true));
    }

    [TestMethod]
    public void He_X001_ClientCase_FoldsDoubledYodInOfanaim()
    {
        // X001 (the client IBT case, relation_19598237): the query "שביל ישראל לאופניים" DOES carry a
        // doubled yod in לאופניים ("ניי"), so the he chain collapses it to לאופנים. The stored
        // name.he.keyword is normalized by the SAME chain at index time, so the painless floor compares
        // the folded query against the folded stored value — they must agree. This is the trap-#2
        // tripwire: a lowercase-only query_norm (no matres) would leave the query as "...לאופניים" while
        // the index stored "...לאופנים", and X001 would silently never match even though the English
        // exact-name rows recover. The fold is what makes X001 reachable.
        Assert.AreEqual("שביל ישראל לאופנים",
            ElasticSearchGateway.NormalizeForKeyword("שביל ישראל לאופניים", isHebrew: true));
        // And on a non-he field (universal chain, no matres) the doubled yod survives — proving the
        // per-field branch is real, not cosmetic.
        Assert.AreEqual("שביל ישראל לאופניים",
            ElasticSearchGateway.NormalizeForKeyword("שביל ישראל לאופניים", isHebrew: false));
    }

    [TestMethod]
    public void He_NiqqudThenMatres_OrderIsCorrect()
    {
        // The index applies niqqud-strip BEFORE matres. A doubled vav carrying niqqud between the
        // two vavs must still collapse after the niqqud is removed. "שׁוֹוֵה"-style: strip niqqud
        // first so the bare doubled vav "וו" becomes adjacent, then fold to "ו".
        // Input: vav + holam(U+05B9) + vav  -> niqqud strip -> "וו" -> matres -> "ו".
        Assert.AreEqual("ו", ElasticSearchGateway.NormalizeForKeyword("וֹו", isHebrew: true));
    }

    // ---- scoring YAML structural guard (the bonus + new param must not break the script) ----
    // A malformed updated_score.yml fails the painless on EVERY shard -> 400 "all shards failed" ->
    // 0 hits, with no client exception (the 2026-06-06 trial-site-empty-scored-search incident). This
    // deserializes the bundled YAML the SAME way ElasticSearchGateway does and asserts the ADR-0026
    // additions parsed: the exact_name_bonus param (typed as a number — a string would silently fail
    // the painless cast) and the bonus block + name_keyword_fields reference in the source. The bonus
    // ships ENABLED at 0.10 (ADR-0026 revised, LIVE-verified, commit cbd79f5c) after the sweep + live
    // /api/search gate cleared.

    private sealed class ScoringScriptDto
    {
        public ScoringScriptBodyDto Script { get; set; }
    }

    private sealed class ScoringScriptBodyDto
    {
        public string Source { get; set; }
        public Dictionary<string, object> Params { get; set; }
    }

    [TestMethod]
    public void ScoringYaml_DeserializesWithExactNameBonusParam_DefaultDisabled()
    {
        var path = Path.Combine(System.AppContext.BaseDirectory, "ElasticSearch", "scoring", "updated_score.yml");
        Assert.IsTrue(File.Exists(path), $"scoring yaml missing at {path}");
        var deserializer = new DeserializerBuilder()
            .WithNamingConvention(CamelCaseNamingConvention.Instance)
            .IgnoreUnmatchedProperties()
            .Build();
        var dto = deserializer.Deserialize<ScoringScriptDto>(File.ReadAllText(path));

        Assert.IsNotNull(dto?.Script, "script root did not deserialize");
        Assert.IsNotNull(dto.Script.Source, "script source missing");
        Assert.IsNotNull(dto.Script.Params, "script params missing");

        // The bonus param must be present and parse as a number (a string would silently disable
        // the cast in painless — the 2026-06-06 incident). It SHIPS ENABLED at 0.10 (ADR-0026 revised,
        // LIVE-verified) — the sweep + live /api/search gate has cleared.
        Assert.IsTrue(dto.Script.Params.ContainsKey("exact_name_bonus"),
            "exact_name_bonus param missing from updated_score.yml");
        // The plain YamlDotNet deserializer used here leaves scalars as strings (the gateway's own
        // ScalarTypeInferringNodeDeserializer is what infers doubles at runtime), so parse invariantly.
        var bonusVal = double.Parse(System.Convert.ToString(dto.Script.Params["exact_name_bonus"]),
            System.Globalization.CultureInfo.InvariantCulture);
        Assert.AreEqual(0.10, bonusVal, 1e-9,
            "exact_name_bonus ships ENABLED at 0.10 (ADR-0026 revised, LIVE-verified, commit cbd79f5c)");

        // The source must reference the bonus machinery, or the param is dead.
        StringAssert.Contains(dto.Script.Source, "exact_name_bonus");
        StringAssert.Contains(dto.Script.Source, "is_exact_name");
        StringAssert.Contains(dto.Script.Source, "name_keyword_fields");
        StringAssert.Contains(dto.Script.Source, "query_norm");
    }
}
