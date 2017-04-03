using System;
using Swashbuckle.AspNetCore.Swagger;
using Swashbuckle.AspNetCore.SwaggerGen;
using System.Linq;
using Microsoft.AspNetCore.Mvc.Authorization;
using Microsoft.AspNetCore.Authorization;
using System.Collections.Generic;

namespace IsraelHiking.API.Swagger
{

    /// <summary>
    /// Adds the authentication icon for calls that require authentication
    /// </summary>
    public class AssignOAuthSecurityRequirements : IOperationFilter
    {
        /// <summary>
        /// Adds authentication using token
        /// </summary>
        /// <param name="operation"></param>
        /// <param name="schemaRegistry"></param>
        /// <param name="apiDescription"></param>    
        public void Apply(Operation operation, OperationFilterContext context)
        {
            var filterPipeline = context.ApiDescription.ActionDescriptor.FilterDescriptors;
            var isAuthorized = filterPipeline.Select(f => f.Filter).Any(f => f is AuthorizeFilter);
            var authorizationRequired = context.ApiDescription.ControllerAttributes().Any(a => a is AuthorizeAttribute);
            if (!authorizationRequired)
            {
                authorizationRequired = context.ApiDescription.ActionAttributes().Any(a => a is AuthorizeAttribute);
            }

            if (isAuthorized && authorizationRequired)
            {
                if (operation.Parameters == null)
                {
                    operation.Parameters = new List<IParameter>();
                }
                operation.Parameters.Add(new NonBodyParameter()
                {
                    Name = "Authorization",
                    In = "header",
                    Description = "From OSM: Baerar client;client secret.",
                    Required = true,
                    Type = "string"
                });
            }
        }
    }
}
