﻿using Microsoft.VisualStudio.TestTools.UnitTesting;

namespace IsraelHiking.DataAccess.Tests
{
    [TestClass]
    public class OffRoadGatewayTests
    {
        [Ignore]
        [TestMethod]
        public void GetAll()
        {
            var gateway = new OffRoadGateway();
            var results = gateway.GetAll().Result;
            Assert.IsTrue(results.Count > 0);
        }

    }
}
