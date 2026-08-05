using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.OpenApi;
using Microsoft.OpenApi;
using System.Collections.Generic;
using System.Diagnostics.CodeAnalysis;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;

namespace IsraelHiking.API.OpenApi;

/// <summary>
/// Adds the Bearer security requirement to operations that require authorization
/// </summary>
[ExcludeFromCodeCoverage]
public class AssignOAuthSecurityOperationTransformer : IOpenApiOperationTransformer
{
    /// <inheritdoc/>
    public Task TransformAsync(OpenApiOperation operation, OpenApiOperationTransformerContext context, CancellationToken cancellationToken)
    {
        var hasAuthorize = context.Description.ActionDescriptor.EndpointMetadata.OfType<AuthorizeAttribute>().Any();
        if (hasAuthorize)
        {
            operation.Security =
            [
                new OpenApiSecurityRequirement
                {
                    { new OpenApiSecuritySchemeReference("Bearer", context.Document), new List<string>() }
                }
            ];
        }
        return Task.CompletedTask;
    }
}
