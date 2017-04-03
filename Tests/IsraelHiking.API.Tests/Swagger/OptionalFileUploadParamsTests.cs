using System.Collections.Generic;
using System.Linq;
using IsraelHiking.API.Swagger;
using Microsoft.VisualStudio.TestTools.UnitTesting;
using Swashbuckle.AspNetCore.Swagger;

namespace IsraelHiking.API.Tests.Swagger
{
    [TestClass]
    public class OptionalFileUploadParamsTests
    {
        [TestMethod]
        public void Apply_ShouldAddFileUploadParams()
        {
            var fileUploadParams = new OptionalFileUploadParams();
            var operation = new Operation { Consumes = new List<string>()};
            
            fileUploadParams.Apply(operation, null);
            
            Assert.IsTrue(operation.Parameters.Any());
            Assert.IsFalse(operation.Parameters.First().Required);
        }
    }
}
