using Swashbuckle.AspNetCore.SwaggerGen;
using System.Collections.Generic;
using System.Linq;
using Swashbuckle.AspNetCore.Swagger;

namespace IsraelHiking.API.Swagger
{
    /// <summary>
    /// Allows required file upload for swagger API 
    /// </summary>
    public class RequiredFileUploadParams : IOperationFilter
    {
        /// <summary>
        /// Applys the required file upload button to the schema
        /// </summary>
        /// <param name="operation"></param>
        /// <param name="context"></param>
        public void Apply(Operation operation, OperationFilterContext context)
        {
            if (operation.Parameters == null)
            {
                operation.Parameters = new List<IParameter>();
            }
            var queryParameters = operation.Parameters.OfType<NonBodyParameter>().Where(p => p.In == "query").ToArray();
            operation.Parameters.Clear();
            foreach (var queryParameter in queryParameters)
            {
                operation.Parameters.Add(queryParameter);
            }
            operation.Parameters.Add(new NonBodyParameter
            {
                Name = "file", // must match parameter name from controller method
                In = "formData",
                Description = "Upload file.",
                Required = true,
                Type = "file"
            });
            operation.Consumes.Add("application/form-data");
        }
    }
}