using System.Collections.Generic;
using System.Linq;
using IsraelHiking.API.Swagger;
using Microsoft.VisualStudio.TestTools.UnitTesting;
using Swashbuckle.Swagger;

namespace IsraelHiking.API.Tests.Swagger
{
    [TestClass]
    public class OptionalFileUploadParamsTests
    {
        [TestMethod]
        public void Apply_ShouldAddFileUploadParams()
        {
            var fileUploadParams = new OptionalFileUploadParams();
            var operation = new Operation { consumes = new List<string>()};

            fileUploadParams.Apply(operation, null, null);

            Assert.IsTrue(operation.parameters.Any());
            var required = operation.parameters.First().required;
            Assert.IsNotNull(required);
            Assert.IsFalse(required.Value);
        }
    }
}
