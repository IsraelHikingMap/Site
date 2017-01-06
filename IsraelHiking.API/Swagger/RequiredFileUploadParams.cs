using System.Web.Http.Description;
using Swashbuckle.Swagger;

namespace IsraelHiking.API.Swagger
{
    /// <summary>
    /// Allows required file upload for swagger API 
    /// </summary>
    public class RequiredFileUploadParams : IOperationFilter
    {
        /// <summary>
        /// Adds the file upload parameter - this should be used as an attribute to a API call
        /// </summary>
        /// <param name="operation"></param>
        /// <param name="schemaRegistry"></param>
        /// <param name="apiDescription"></param>
        public void Apply(Operation operation, SchemaRegistry schemaRegistry, ApiDescription apiDescription)
        {
            operation.consumes.Add("application/form-data");
            operation.parameters = new[]
            {
                new Parameter
                {
                    name = "file",
                    @in = "formData",
                    required = true,
                    type = "file"
                }
            };
        }
    }
}