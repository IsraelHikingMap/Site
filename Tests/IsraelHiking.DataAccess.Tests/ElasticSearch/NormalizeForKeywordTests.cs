using System.Collections.Generic;
using System.IO;
using Microsoft.VisualStudio.TestTools.UnitTesting;
using IsraelHiking.DataAccess.ElasticSearch;

namespace IsraelHiking.DataAccess.Tests.ElasticSearch;

[TestClass]
public class NormalizeForKeywordTests
{

    [TestMethod]
    public void Base_FoldsLatinAccentsAndLowercases()
    {
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
        Assert.AreEqual("דוויד", ElasticSearchGateway.NormalizeForKeyword("דוויד", isHebrew: false));
    }

    [TestMethod]
    public void He_CollapsesDoubledVav()
    {
        Assert.AreEqual("דויד", ElasticSearchGateway.NormalizeForKeyword("דוויד", isHebrew: true));
    }

    [TestMethod]
    public void He_CollapsesDoubledYod()
    {
        Assert.AreEqual("איל", ElasticSearchGateway.NormalizeForKeyword("אייל", isHebrew: true));
    }

    [TestMethod]
    public void He_LeavesSingleInteriorVavAndYodIntact()
    {
        Assert.AreEqual("אור", ElasticSearchGateway.NormalizeForKeyword("אור", isHebrew: true));
        Assert.AreEqual("דוד", ElasticSearchGateway.NormalizeForKeyword("דוד", isHebrew: true));
    }

    [TestMethod]
    public void He_StripsNiqqud()
    {
        Assert.AreEqual("שלום", ElasticSearchGateway.NormalizeForKeyword("שָׁלוֹם", isHebrew: true));
    }

    [TestMethod]
    public void He_FoldsDoubledYodInIsraelBikeTrail()
    {
        Assert.AreEqual("שביל ישראל לאופנים",
            ElasticSearchGateway.NormalizeForKeyword("שביל ישראל לאופניים", isHebrew: true));
        Assert.AreEqual("שביל ישראל לאופניים",
            ElasticSearchGateway.NormalizeForKeyword("שביל ישראל לאופניים", isHebrew: false));
    }

    [TestMethod]
    public void He_NiqqudThenMatres_OrderIsCorrect()
    {
        Assert.AreEqual("ו", ElasticSearchGateway.NormalizeForKeyword("וֹו", isHebrew: true));
    }

}
