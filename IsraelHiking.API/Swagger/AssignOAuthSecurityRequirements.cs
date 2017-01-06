using System.Collections.Generic;
using System.Diagnostics.CodeAnalysis;
using System.Linq;
using System.Web.Http;
using System.Web.Http.Description;
using Swashbuckle.Swagger;

namespace IsraelHiking.API.Swagger
{

    /// <summary>
    /// Adds the authentication icon for calls that require authentication
    /// </summary>
    [ExcludeFromCodeCoverage]
    public class AssignOAuthSecurityRequirements : IOperationFilter
    {
        /// <summary>
        /// Adds authentication using token
        /// </summary>
        /// <param name="operation"></param>
        /// <param name="schemaRegistry"></param>
        /// <param name="apiDescription"></param>
        public void Apply(Operation operation, SchemaRegistry schemaRegistry, ApiDescription apiDescription)
        {
            var actFilters = apiDescription.ActionDescriptor.GetFilterPipeline();
            var allowsAnonymous = actFilters.Select(f => f.Instance).OfType<OverrideAuthorizationAttribute>().Any();
            if (allowsAnonymous)
            {
                return; // must be an anonymous method
            }

            if (operation.security == null)
                operation.security = new List<IDictionary<string, IEnumerable<string>>>();

            var oAuthRequirements = new Dictionary<string, IEnumerable<string>>
            {
                {"token", new List<string>()}
            };

            operation.security.Add(oAuthRequirements);
        }
    }
}
