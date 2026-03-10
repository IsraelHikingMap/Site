using IsraelHiking.Common;
using IsraelHiking.Common.Configuration;
using IsraelHiking.Common.DataContainer;
using Microsoft.Extensions.Options;
using Microsoft.VisualStudio.TestTools.UnitTesting;
using NSubstitute;
using System.IO;
using System.Net.Http;

namespace IsraelHiking.DataAccess.Tests;

[TestClass]
[Ignore]
public class ImageCreatorGatewayTests
{
    [TestMethod]
    public void CreateImage()
    {
        var factory = Substitute.For<IHttpClientFactory>();
        factory.CreateClient().Returns(new HttpClient());
        var options = Substitute.For<IOptions<ConfigurationData>>();
        options.Value.Returns(new ConfigurationData
        {
            ImageCreatorServerAddress = "https://mapeak.com/api/temp-images/"
        });
        var gateway = new ImageCreationGateway(factory, options);
        var results = gateway.Create(new DataContainerPoco
        {
            Routes = [
                new RouteData {
                    Segments = [
                        new RouteSegmentData {
                            Latlngs = [
                                new LatLngTime {
                                    Lat = 30,
                                    Lng = 35
                                },
                                new LatLngTime {
                                    Lat = 30.50614,
                                    Lng = 35
                                }
                            ]
                        }
                    ]
                }
            ]
        }, 128, 128).Result;
        Assert.IsTrue(results.Length > 0);
        File.WriteAllBytes("/Users/harelmazor/dev/Site/IsraelHiking.Web/temp.jpg", results);
    }
}