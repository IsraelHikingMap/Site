using System.Collections.Generic;
using System.Linq;
using System.Text;
using IsraelHiking.API.Converters;
using IsraelHiking.API.Executors;
using IsraelHiking.API.Gpx;
using IsraelHiking.API.Services;
using IsraelHiking.Common;
using Microsoft.VisualStudio.TestTools.UnitTesting;
using NSubstitute;
using Microsoft.Extensions.Options;

namespace IsraelHiking.API.Tests.Services
{
    [TestClass]
    public class RouteDataSplitterServiceTests
    {
        #region GPX string data

        private string gpxString = @"<?xml version='1.0'?>
            <gpx xmlns:xsd='http://www.w3.org/2001/XMLSchema' xmlns:xsi='http://www.w3.org/2001/XMLSchema-instance' version='1.1' creator='IsraelHikingMap' xmlns='http://www.topografix.com/GPX/1/1'>
              <trk>
                <name>Original TWL route</name>
                <trkseg>
                  <trkpt lat = '31.7394989' lon='34.972278119'>
                    <ele>0</ele>
                  </trkpt>
                  <trkpt lat = '31.7394989' lon='34.972278119'>
                    <ele>0</ele>
                  </trkpt>
                </trkseg>
                <trkseg>
                  <trkpt lat = '31.7394989' lon='34.972278119'>
                    <ele>0</ele>
                  </trkpt>
                  <trkpt lat = '31.733526968' lon='34.966669074'>
                    <ele>0</ele>
                  </trkpt>
                </trkseg>
                <trkseg>
                  <trkpt lat = '31.733526968' lon='34.966669074'>
                    <ele>0</ele>
                  </trkpt>
                  <trkpt lat = '31.720255782' lon='34.964140177'>
                    <ele>0</ele>
                  </trkpt>
                  <trkpt lat = '31.715199175' lon='34.960967437'>
                    <ele>0</ele>
                  </trkpt>
                  <trkpt lat = '31.709721448' lon='34.96380952'>
                    <ele>0</ele>
                  </trkpt>
                </trkseg>
                <trkseg>
                  <trkpt lat = '31.709721448' lon='34.96380952'>
                    <ele>0</ele>
                  </trkpt>
                  <trkpt lat = '31.706502407' lon='34.964113477'>
                    <ele>0</ele>
                  </trkpt>
                  <trkpt lat = '31.706345783' lon='34.967067703'>
                    <ele>0</ele>
                  </trkpt>
                  <trkpt lat = '31.703714513' lon='34.968192817'>
                    <ele>0</ele>
                  </trkpt>
                </trkseg>
                <trkseg>
                  <trkpt lat = '31.703714513' lon='34.968192817'>
                    <ele>0</ele>
                  </trkpt>
                  <trkpt lat = '31.69934096' lon='34.978067131'>
                    <ele>0</ele>
                  </trkpt>
                  <trkpt lat = '31.692539667' lon='34.977377501'>
                    <ele>0</ele>
                  </trkpt>
                  <trkpt lat = '31.692397731' lon='34.978664683'>
                    <ele>0</ele>
                  </trkpt>
                  <trkpt lat = '31.695683317' lon='34.98020703'>
                    <ele>0</ele>
                  </trkpt>
                </trkseg>
                <trkseg>
                  <trkpt lat = '31.695683317' lon='34.98020703'>
                    <ele>0</ele>
                  </trkpt>
                  <trkpt lat = '31.694223462' lon='34.985874907'>
                    <ele>0</ele>
                  </trkpt>
                  <trkpt lat = '31.693636188' lon='34.985275103'>
                    <ele>0</ele>
                  </trkpt>
                  <trkpt lat = '31.692761417' lon='34.990424547'>
                    <ele>0</ele>
                  </trkpt>
                  <trkpt lat = '31.691808603' lon='34.997546489'>
                    <ele>0</ele>
                  </trkpt>
                </trkseg>
                <trkseg>
                  <trkpt lat = '31.691808603' lon='34.997546489'>
                    <ele>0</ele>
                  </trkpt>
                  <trkpt lat = '31.6872857' lon='35.000204229'>
                    <ele>0</ele>
                  </trkpt>
                  <trkpt lat = '31.675814137' lon='35.005787949'>
                    <ele>0</ele>
                  </trkpt>
                </trkseg>
                <trkseg>
                  <trkpt lat = '31.675814137' lon='35.005787949'>
                    <ele>0</ele>
                  </trkpt>
                  <trkpt lat = '31.675521482' lon='35.008878523'>
                    <ele>0</ele>
                  </trkpt>
                  <trkpt lat = '31.678080511' lon='35.013165219'>
                    <ele>0</ele>
                  </trkpt>
                  <trkpt lat = '31.677641904' lon='35.021233893'>
                    <ele>0</ele>
                  </trkpt>
                  <trkpt lat = '31.67866952' lon='35.020894313'>
                    <ele>0</ele>
                  </trkpt>
                </trkseg>
                <trkseg>
                  <trkpt lat = '31.67866952' lon='35.020894313'>
                    <ele>0</ele>
                  </trkpt>
                  <trkpt lat = '31.677349689' lon='35.018829995'>
                    <ele>0</ele>
                  </trkpt>
                  <trkpt lat = '31.680203331' lon='35.02132357'>
                    <ele>0</ele>
                  </trkpt>
                  <trkpt lat = '31.682686646' lon='35.023470006'>
                    <ele>0</ele>
                  </trkpt>
                  <trkpt lat = '31.682168221' lon='35.026645573'>
                    <ele>0</ele>
                  </trkpt>
                  <trkpt lat = '31.684434257' lon='35.028275827'>
                    <ele>0</ele>
                  </trkpt>
                </trkseg>
                <trkseg>
                  <trkpt lat = '31.684434257' lon='35.028275827'>
                    <ele>0</ele>
                  </trkpt>
                  <trkpt lat = '31.684582716' lon='35.031186464'>
                    <ele>0</ele>
                  </trkpt>
                  <trkpt lat = '31.687433937' lon='35.032130179'>
                    <ele>0</ele>
                  </trkpt>
                  <trkpt lat = '31.689765541' lon='35.035564143'>
                    <ele>0</ele>
                  </trkpt>
                  <trkpt lat = '31.690861847' lon='35.039253712'>
                    <ele>0</ele>
                  </trkpt>
                </trkseg>
                <trkseg>
                  <trkpt lat = '31.690861847' lon='35.039253712'>
                    <ele>0</ele>
                  </trkpt>
                  <trkpt lat = '31.695909206' lon='35.050678525'>
                    <ele>0</ele>
                  </trkpt>
                  <trkpt lat = '31.696778642' lon='35.053588329'>
                    <ele>0</ele>
                  </trkpt>
                  <trkpt lat = '31.695906597' lon='35.055826013'>
                    <ele>0</ele>
                  </trkpt>
                  <trkpt lat = '31.6960535' lon='35.057967039'>
                    <ele>0</ele>
                  </trkpt>
                  <trkpt lat = '31.695980543' lon='35.064918378'>
                    <ele>0</ele>
                  </trkpt>
                </trkseg>
                <trkseg>
                  <trkpt lat = '31.695980543' lon='35.064918378'>
                    <ele>0</ele>
                  </trkpt>
                  <trkpt lat = '31.690283042' lon='35.066899749'>
                    <ele>0</ele>
                  </trkpt>
                  <trkpt lat = '31.684947165' lon='35.061835004'>
                    <ele>0</ele>
                  </trkpt>
                  <trkpt lat = '31.681658837' lon='35.057199836'>
                    <ele>0</ele>
                  </trkpt>
                </trkseg>
                <trkseg>
                  <trkpt lat = '31.681658837' lon='35.057199836'>
                    <ele>0</ele>
                  </trkpt>
                  <trkpt lat = '31.696414528' lon='35.065867029'>
                    <ele>0</ele>
                  </trkpt>
                  <trkpt lat = '31.697150552' lon='35.070760269'>
                    <ele>0</ele>
                  </trkpt>
                  <trkpt lat = '31.698831125' lon='35.073595255'>
                    <ele>0</ele>
                  </trkpt>
                  <trkpt lat = '31.697587937' lon='35.074873447'>
                    <ele>0</ele>
                  </trkpt>
                </trkseg>
                <trkseg>
                  <trkpt lat = '31.697587937' lon='35.074873447'>
                    <ele>0</ele>
                  </trkpt>
                  <trkpt lat = '31.693353372' lon='35.078824567'>
                    <ele>0</ele>
                  </trkpt>
                  <trkpt lat = '31.692545415' lon='35.082433049'>
                    <ele>0</ele>
                  </trkpt>
                  <trkpt lat = '31.698777896' lon='35.083036192'>
                    <ele>0</ele>
                  </trkpt>
                  <trkpt lat = '31.698123468' lon='35.086982188'>
                    <ele>0</ele>
                  </trkpt>
                </trkseg>
                <trkseg>
                  <trkpt lat = '31.698123468' lon='35.086982188'>
                    <ele>0</ele>
                  </trkpt>
                  <trkpt lat = '31.703307898' lon='35.085688258'>
                    <ele>0</ele>
                  </trkpt>
                  <trkpt lat = '31.70133827' lon='35.082136005'>
                    <ele>0</ele>
                  </trkpt>
                  <trkpt lat = '31.699835777' lon='35.076937657'>
                    <ele>0</ele>
                  </trkpt>
                  <trkpt lat = '31.698376297' lon='35.078395452'>
                    <ele>0</ele>
                  </trkpt>
                  <trkpt lat = '31.700353075' lon='35.080027654'>
                    <ele>0</ele>
                  </trkpt>
                </trkseg>
                <trkseg>
                  <trkpt lat = '31.700353075' lon='35.080027654'>
                    <ele>0</ele>
                  </trkpt>
                  <trkpt lat = '31.699835273' lon='35.076462973'>
                    <ele>0</ele>
                  </trkpt>
                  <trkpt lat = '31.700132246' lon='35.075861271'>
                    <ele>0</ele>
                  </trkpt>
                  <trkpt lat = '31.701669485' lon='35.079730424'>
                    <ele>0</ele>
                  </trkpt>
                  <trkpt lat = '31.703926781' lon='35.082301181'>
                    <ele>0</ele>
                  </trkpt>
                  <trkpt lat = '31.705247159' lon='35.085949358'>
                    <ele>0</ele>
                  </trkpt>
                </trkseg>
                <trkseg>
                  <trkpt lat = '31.705247159' lon='35.085949358'>
                    <ele>0</ele>
                  </trkpt>
                  <trkpt lat = '31.70831298' lon='35.085438831'>
                    <ele>0</ele>
                  </trkpt>
                  <trkpt lat = '31.711381246' lon='35.087407487'>
                    <ele>0</ele>
                  </trkpt>
                  <trkpt lat = '31.713170033' lon='35.090622866'>
                    <ele>0</ele>
                  </trkpt>
                </trkseg>
              </trk>
            </gpx>";

        #endregion

        private RouteDataSplitterService _service;

        [TestInitialize]
        public void TestInitialize()
        {
            var options = new ConfigurationData
            {
                InitialSplitSimplificationDistanceTolerace = 50,
                MaxSegmentsNumber = 40,
                MinimalSegmentLength = 500
            };
            var optionsProvider = Substitute.For<IOptions<ConfigurationData>>();
            optionsProvider.Value.Returns(options);
            
            _service = new RouteDataSplitterService(new ItmWgs84MathTransfromFactory(), optionsProvider);
        }

        [TestMethod]
        public void TestSimplifyRouteData()
        {
            var converter = new GpxDataContainerConverter();
            var container = converter.ToDataContainer(Encoding.ASCII.GetBytes(gpxString).ToGpx());

            var route = _service.Split(container.Routes.First());

            Assert.IsTrue(route.Segments.Count <= 40);
        }

        [TestMethod]
        public void SimplifyRoundRoute()
        {
            var routeToSimplify = new RouteData
            {
                Segments = new List<RouteSegmentData>
                {
                    new RouteSegmentData
                    {
                        Latlngs = new List<LatLng>
                        {
                            new LatLng {Lat = 1, Lng = 1},
                            new LatLng {Lat = 2, Lng = 2},
                            new LatLng {Lat = 3, Lng = 3},
                            new LatLng {Lat = 4, Lng = 4},
                            new LatLng {Lat = 1, Lng = 1},
                        }
                    }
                }
            };

            var route = _service.Split(routeToSimplify);

            Assert.IsTrue(route.Segments.Count <= 5);
        }

        [TestMethod]
        public void SimplifyRouteWithTwoPoints_ShouldNotBeSimplified()
        {
            var routeToSimplify = new RouteData
            {
                Segments = new List<RouteSegmentData>
                {
                    new RouteSegmentData
                    {
                        Latlngs = new List<LatLng>
                        {
                            new LatLng {Lat = 1, Lng = 1},
                            new LatLng {Lat = 2, Lng = 2}
                        }
                    }
                }
            };

            var route = _service.Split(routeToSimplify);

            Assert.AreEqual(2, route.Segments.Count);
        }
    }
}
