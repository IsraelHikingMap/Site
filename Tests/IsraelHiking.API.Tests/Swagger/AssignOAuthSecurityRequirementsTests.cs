using System.Collections.Generic;
using System.Linq;
using System.Reflection;
using Swashbuckle.AspNetCore.Swagger;
using IsraelHiking.API.Swagger;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc.ApiExplorer;
using Microsoft.AspNetCore.Mvc.Authorization;
using Microsoft.AspNetCore.Mvc.Controllers;
using Microsoft.AspNetCore.Mvc.Filters;
using Microsoft.VisualStudio.TestTools.UnitTesting;
using NSubstitute;
using Swashbuckle.AspNetCore.SwaggerGen;

namespace IsraelHiking.API.Tests.Swagger
{
    [Authorize]
    internal class TestContollerWithAuthorization { }

    [Authorize]
    internal class TestContollerWithAuthorizationAction
    {
        [Authorize]
        public void Action() { }
    }

    [TestClass]
    public class AssignOAuthSecurityRequirementsTests
    {
        [TestMethod]
        public void WhenAuthorizationIsRequiredOnController_AddAthorizationHeaderInput()
        {
            var assignOAuthSecurityRequirements = new AssignOAuthSecurityRequirements();
            var operation = new Operation();
            var apiDescription = new ApiDescription
            {
                ActionDescriptor = new ControllerActionDescriptor
                {
                    FilterDescriptors = new List<FilterDescriptor>
                    {
                        new FilterDescriptor(new AuthorizeFilter(new AuthorizationPolicy(
                            new List<IAuthorizationRequirement>
                            {
                                Substitute.For<IAuthorizationRequirement>()
                            }, Enumerable.Empty<string>())), 0)
                    },
                    ControllerTypeInfo = typeof(TestContollerWithAuthorization).GetTypeInfo()
                }
            };
            var context = new OperationFilterContext(apiDescription, null);
            assignOAuthSecurityRequirements.Apply(operation, context);
            
            Assert.AreEqual(1, operation.Parameters.OfType<NonBodyParameter>().Count());
        }

        [TestMethod]
        public void WhenAuthorizationIsRequiredOnControllerAction_AddAthorizationHeaderInput()
        {
            var assignOAuthSecurityRequirements = new AssignOAuthSecurityRequirements();
            var operation = new Operation();
            var apiDescription = new ApiDescription
            {
                ActionDescriptor = new ControllerActionDescriptor
                {
                    FilterDescriptors = new List<FilterDescriptor>
                    {
                        new FilterDescriptor(new AuthorizeFilter(new AuthorizationPolicy(
                            new List<IAuthorizationRequirement>
                            {
                                Substitute.For<IAuthorizationRequirement>()
                            }, Enumerable.Empty<string>())), 0)
                    },
                    ControllerTypeInfo = typeof(TestContollerWithAuthorizationAction).GetTypeInfo()
                }
            };
            var context = new OperationFilterContext(apiDescription, null);
            assignOAuthSecurityRequirements.Apply(operation, context);

            Assert.AreEqual(1, operation.Parameters.OfType<NonBodyParameter>().Count());
        }
    }
}
