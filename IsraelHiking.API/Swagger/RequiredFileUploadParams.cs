using Swashbuckle.AspNetCore.SwaggerGen;
using System.Collections.Generic;
using Swashbuckle.AspNetCore.Swagger;

namespace IsraelHiking.API.Swagger
{
    /// <summary>
    /// Allows required file upload for swagger API 
    /// </summary>
    public class RequiredFileUploadParams : IOperationFilter
    {
        public void Apply(Operation operation, OperationFilterContext context)
        {
            operation.Consumes.Add("application/form-data");
            if (operation.Parameters == null)
            {
                operation.Parameters = new List<IParameter>();
            }
            operation.Parameters.Add(new BodyParameter
            {
                Name = "file",
                In = "formData",
                Required = true,
                // HM TODO: type?
            });
        }
    }
}