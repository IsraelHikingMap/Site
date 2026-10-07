using System.Net.Http;
using IsraelHiking.Common.Configuration;
using IsraelHiking.DataAccessInterfaces;
using Microsoft.Extensions.Options;
using Microsoft.VisualStudio.TestTools.UnitTesting;
using NSubstitute;

namespace IsraelHiking.DataAccess.Tests;

[TestClass]
public class UserDevicesGatewayTests
{
    [TestMethod]
    public void UpdateUserDevice_UnreachableService_ShouldNotThrow()
    {
        CreateGateway("http://localhost:1/").UpdateUserDevice("some-device", "ios", "9.21.2").Wait();
    }

    [TestMethod]
    [Ignore]
    public void UpdateUserDevice_GivenValidRequest_ShouldStoreIt()
    {
        CreateGateway(new ConfigurationData().UserDevicesApiAddress)
            .UpdateUserDevice("some-device", "ios", "9.21.2").Wait();
    }

    private static IUserDevicesGateway CreateGateway(string address)
    {
        var options = Substitute.For<IOptions<ConfigurationData>>();
        options.Value.Returns(new ConfigurationData { UserDevicesApiAddress = address });
        var httpFactory = Substitute.For<IHttpClientFactory>();
        httpFactory.CreateClient().Returns(new HttpClient());
        var tokenProvider = Substitute.For<IOsmAccessTokenProvider>();
        tokenProvider.GetToken().Returns("some-token");
        return new UserDevicesGateway(httpFactory, tokenProvider, options, new TraceLogger());
    }
}
