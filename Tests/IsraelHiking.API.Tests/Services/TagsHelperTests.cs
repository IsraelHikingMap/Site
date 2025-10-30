using IsraelHiking.API.Services;
using IsraelHiking.Common;
using IsraelHiking.Common.Configuration;
using Microsoft.Extensions.Options;
using Microsoft.VisualStudio.TestTools.UnitTesting;
using NetTopologySuite.Features;
using NSubstitute;

namespace IsraelHiking.API.Tests.Services;

[TestClass]
public class TagsHelperTests
{
    private ITagsHelper _tagsHelper;

    [TestInitialize]
    public void TestInitialize()
    {
        _tagsHelper = new TagsHelper();
    }

    [TestMethod]
    [DataRow("icon-leaf")]
    [DataRow("icon-hike")]
    [DataRow("icon-bike")]
    [DataRow("icon-four-by-four")]
    [DataRow("icon-ruins")]
    [DataRow("icon-archaeological")]
    [DataRow("icon-memorial")]
    [DataRow("icon-cave")]
    [DataRow("icon-picnic")]
    [DataRow("icon-tint")]
    [DataRow("icon-tree")]
    [DataRow("icon-flowers")]
    [DataRow("icon-waterhole")]
    [DataRow("icon-water-well")]
    [DataRow("icon-cistern")]
    [DataRow("icon-waterfall")]
    [DataRow("icon-river")]
    [DataRow("icon-home")]
    [DataRow("icon-viewpoint")]
    [DataRow("icon-campsite")]
    [DataRow("icon-star")]
    [DataRow("icon-artwork")]
    [DataRow("icon-alpinehut")]
    [DataRow("icon-peak")]
    [DataRow("icon-inature")]
    [DataRow("icon-hike")]
    [DataRow("icon-bike")]
    [DataRow("icon-four-by-four")]
    [DataRow("icon-ruins")]
    [DataRow("icon-archaeological")]
    [DataRow("icon-memorial")]
    [DataRow("icon-cave")]
    [DataRow("icon-picnic")]
    [DataRow("icon-tint")]
    [DataRow("icon-tree")]
    [DataRow("icon-flowers")]
    [DataRow("icon-waterhole")]
    [DataRow("icon-water-well")]
    [DataRow("icon-cistern")]
    [DataRow("icon-waterfall")]
    [DataRow("icon-river")]
    [DataRow("icon-home")]
    [DataRow("icon-viewpoint")]
    [DataRow("icon-campsite")]
    [DataRow("icon-star")]
    [DataRow("icon-artwork")]
    [DataRow("icon-alpinehut")]
    [DataRow("icon-peak")]    
    [DataRow("icon-inature")]
    public void SymmetricalTagsCheck_ShouldPass(string icon)
    {
        var tagCombinations = _tagsHelper.FindTagsForIcon(icon);
        foreach (var tags in tagCombinations)
        {
            var attributesTable = new AttributesTable();
            foreach (var tag in tags)
            {
                attributesTable.Add(tag.Key, tag.Value);
            }
            var iconColorCategory = _tagsHelper.GetIconColorCategoryForTags(attributesTable);
            Assert.AreEqual(icon, iconColorCategory.Icon);
        }
    }
}