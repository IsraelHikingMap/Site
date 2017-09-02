using System;
using System.Collections.Generic;
using System.Text;
using Microsoft.VisualStudio.TestTools.UnitTesting;

namespace IsraelHiking.DataAccess.Tests
{
    [TestClass]
    public class OffRoadGatewayTests
    {
        [TestMethod]
        public void GetAll()
        {
            var gateway = new OffRoadGateway();
            var results = gateway.GetAll().Result;
            Assert.IsTrue(results.Count > 0);
        }

    }
}
