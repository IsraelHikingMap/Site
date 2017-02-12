using System;
using System.Collections.Generic;
using GeoAPI.Geometries;
using IsraelHiking.API.Executors;
using Microsoft.VisualStudio.TestTools.UnitTesting;
using NetTopologySuite.Geometries;

namespace IsraelHiking.API.Tests.Executors
{
    [TestClass]
    public class GpxProlongerExecutorTests
    {
        private IGpxProlongerExecutor _executor;

        [TestInitialize]
        public void TestInitialize()
        {
            _executor = new GpxProlongerExecutor();
        }

        [TestMethod]
        public void ProlongStart_NoPoints_ShouldReturnOriginalLine()
        {
            var lineToProlong = new LineString(new [] { new Coordinate(0,0), new Coordinate(1,1)});

            var results = _executor.ProlongLineStart(lineToProlong, new Coordinate[0], new List<LineString>(), 5, 200);

            Assert.AreEqual(lineToProlong.Coordinates.Length, results.Coordinates.Length);
        }

        [TestMethod]
        public void ProlongEnd_NoPoints_ShouldReturnOriginalLine()
        {
            var lineToProlong = new LineString(new[] { new Coordinate(0, 0), new Coordinate(1, 1) });

            var results = _executor.ProlongLineEnd(lineToProlong, new Coordinate[0], new List<LineString>(), 5, 200);

            Assert.AreEqual(lineToProlong.Coordinates.Length, results.Coordinates.Length);
        }
    }
}
