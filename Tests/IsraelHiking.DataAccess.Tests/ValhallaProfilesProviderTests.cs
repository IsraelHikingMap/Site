using System.IO;
using IsraelHiking.Common.Api;
using IsraelHiking.Common.Configuration;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using Microsoft.VisualStudio.TestTools.UnitTesting;
using NSubstitute;

namespace IsraelHiking.DataAccess.Tests;

[TestClass]
public class ValhallaProfilesProviderTests
{
    private static ValhallaProfilesProvider CreateProvider(string filePath)
    {
        var options = Substitute.For<IOptions<ConfigurationData>>();
        options.Value.Returns(new ConfigurationData { ValhallaProfilesFilePath = filePath });
        return new ValhallaProfilesProvider(options, Substitute.For<ILogger>());
    }

    [TestMethod]
    public void GetProfile_FromTheShippedFile_ShouldGetTheCostingAndItsOptions()
    {
        var provider = CreateProvider("valhalla-profiles.json");

        var profile = provider.GetProfile(ProfileType.Car4WheelDrive);

        Assert.AreEqual("auto", profile.Costing);
        Assert.IsTrue(profile.CostingOptions.HasValue);
        Assert.AreEqual(1.0, profile.CostingOptions.Value.GetProperty("use_tracks").GetDouble());
    }

    [TestMethod]
    public void GetProfile_ProfileWhichIsNotInTheFile_ShouldFallBackToTheDefaultProfile()
    {
        var provider = CreateProvider("valhalla-profiles.json");

        var profile = provider.GetProfile(ProfileType.None);

        Assert.AreEqual("pedestrian", profile.Costing);
    }

    [TestMethod]
    public void GetProfile_MissingFile_ShouldFallBackToPedestrianWithoutOptions()
    {
        var provider = CreateProvider("no-such-file.json");

        var profile = provider.GetProfile(ProfileType.Bike);

        Assert.AreEqual("pedestrian", profile.Costing);
        Assert.IsFalse(profile.CostingOptions.HasValue);
    }

    [TestMethod]
    public void GetProfile_FileWasChanged_ShouldReadItAgain()
    {
        var filePath = Path.GetTempFileName();
        File.WriteAllText(filePath, """{ "foot": { "costing": "pedestrian" } }""");
        var provider = CreateProvider(filePath);
        Assert.AreEqual("pedestrian", provider.GetProfile(ProfileType.Foot).Costing);

        File.WriteAllText(filePath, """{ "foot": { "costing": "bicycle" } }""");
        File.SetLastWriteTimeUtc(filePath, File.GetLastWriteTimeUtc(filePath).AddSeconds(1));

        Assert.AreEqual("bicycle", provider.GetProfile(ProfileType.Foot).Costing);
        File.Delete(filePath);
    }
}
