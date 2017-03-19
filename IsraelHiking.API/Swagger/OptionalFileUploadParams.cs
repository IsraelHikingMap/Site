using System.Collections.Generic;
using Swashbuckle.AspNetCore.SwaggerGen;
using Swashbuckle.AspNetCore.Swagger;

namespace IsraelHiking.API.Swagger
{
    /// <summary>
    /// Allows optional file upload for swagger API 
    /// </summary>
    public class OptionalFileUploadParams : IOperationFilter
    {
        public void Apply(Operation operation, OperationFilterContext context)
        {
            operation.Consumes.Add("application/form-data");
            if (operation.Parameters == null)
            {
                operation.Parameters = new List<IParameter>();
            }
            operation.Parameters.Clear();
            operation.Parameters.Add(new NonBodyParameter
            {
                Name = "file", // must match parameter name from controller method
                In = "formData",
                Description = "Upload file.",
                Required = false,
                Type = "file"
            });
            operation.Consumes.Add("application/form-data");
        }
    }
}
