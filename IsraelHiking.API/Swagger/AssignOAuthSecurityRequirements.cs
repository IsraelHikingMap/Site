namespace IsraelHiking.API.Swagger
{

    /// <summary>
    /// Adds the authentication icon for calls that require authentication
    /// </summary>

    // HM TODO: bring this back
    //public class AssignOAuthSecurityRequirements : IOperationFilter
    //{
    //    /// <summary>
    //    /// Adds authentication using token
    //    /// </summary>
    //    /// <param name="operation"></param>
    //    /// <param name="schemaRegistry"></param>
    //    /// <param name="apiDescription"></param>
    //    public void Apply(Operation operation, SchemaRegistry schemaRegistry, ApiDescription apiDescription)
    //    {
    //        var actualFilters = apiDescription.ActionDescriptor.ActionConstraints.GetFilterPipeline();
    //        var allowsAnonymous = actualFilters.Select(f => f.Instance).OfType<OverrideAuthorizationAttribute>().Any();
    //        if (allowsAnonymous)
    //        {
    //            return; // must be an anonymous method
    //        }
    //    }
    //
    //    public void Apply(Operation operation, OperationFilterContext context)
    //    {
    //        // HM TODO: swagger require auth.
    //        var actualFilters = context.ApiDescription.ActionDescriptor.ActionConstraints.GetFilterPipeline();
    //        var allowsAnonymous = actualFilters.Select(f => f.Instance).OfType<OverrideAuthorizationAttribute>().Any();
    //        if (allowsAnonymous)
    //        {
    //            return; // must be an anonymous method
    //        }
    //
    //        if (operation.Security == null)
    //        {
    //            operation.Security = new List<IDictionary<string, IEnumerable<string>>>();
    //        }
    //        var oAuthRequirements = new Dictionary<string, IEnumerable<string>>
    //        {
    //            {"token", new List<string>()}
    //        };
    //
    //        operation.Security.Add(oAuthRequirements);
    //    }
    //}
}
