using Microsoft.AspNetCore.OpenApi;
using Microsoft.OpenApi;
using System.Collections.Generic;
using System.Diagnostics.CodeAnalysis;
using System.Reflection;
using System.Threading;
using System.Threading.Tasks;

namespace IsraelHiking.API.OpenApi;

/// <summary>
/// Sets the API title/version and registers the Bearer security scheme on the OpenAPI document
/// </summary>
[ExcludeFromCodeCoverage]
public class ApiInfoDocumentTransformer : IOpenApiDocumentTransformer
{
    /// <inheritdoc/>
    public Task TransformAsync(OpenApiDocument document, OpenApiDocumentTransformerContext context, CancellationToken cancellationToken)
    {
        document.Info.Title = "Mapeak API";
        document.Info.Version = Assembly.GetEntryAssembly()?.GetName().Version?.ToString();
        document.Components ??= new OpenApiComponents();
        document.Components.SecuritySchemes ??= new Dictionary<string, IOpenApiSecurityScheme>();
        document.Components.SecuritySchemes["Bearer"] = new OpenApiSecurityScheme
        {
            Description = "OSM OAuth2 token",
            Type = SecuritySchemeType.Http,
            Scheme = "bearer",
            In = ParameterLocation.Header
        };
        return Task.CompletedTask;
    }
}
