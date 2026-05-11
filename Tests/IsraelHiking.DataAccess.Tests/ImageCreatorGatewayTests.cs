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
public class ImageCreatorGatewayTests
{
    [TestMethod]
    [Ignore]
    public void CreateImage()
    {
        var factory = Substitute.For<IHttpClientFactory>();
        factory.CreateClient().Returns(new HttpClient());
        var options = Substitute.For<IOptions<ConfigurationData>>();
        options.Value.Returns(new ConfigurationData());
        var gateway = new ImageCreationGateway(factory, options);
        var results = gateway.Create(new DataContainerPoco
        {
            Routes = [
                new RouteData {
                    Segments = [
                        new RouteSegmentData {
                            Latlngs = [
                                new LatLngTime {
                                    Lat = 31.287068,
                                    Lng = 34.837875
                                },
                                new LatLngTime {
                                    Lat = 31.286924,
                                    Lng = 34.837885
                                },
                                new LatLngTime {
                                    Lat = 31.28697,
                                    Lng = 34.837932
                                },
                                new LatLngTime {
                                    Lat = 31.286764,
                                    Lng = 34.837992
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