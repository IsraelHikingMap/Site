using System.Collections.Generic;
using Swashbuckle.AspNetCore.SwaggerGen;
using Swashbuckle.AspNetCore.Swagger;
using System.Linq;

namespace IsraelHiking.API.Swagger
{
    /// <summary>
    /// Allows optional file upload for swagger API 
    /// </summary>
    public class OptionalFileUploadParams : IOperationFilter
    {
        /// <summary>
        /// Applys the optinal file upload button to the schema
        /// </summary>
        /// <param name="operation"></param>
        /// <param name="context"></param>
        public void Apply(Operation operation, OperationFilterContext context)
        {
            operation.Consumes.Add("application/form-data");
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
                Required = false,
                Type = "file"
            });
            operation.Consumes.Add("application/form-data");
        }
    }
}
