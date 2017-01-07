using System.Collections.Generic;
using System.Web.Http.Description;
using Swashbuckle.Swagger;

namespace IsraelHiking.API.Swagger
{
    /// <summary>
    /// Allows optional file upload for swagger API 
    /// </summary>
    public class OptionalFileUploadParams : IOperationFilter
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
            if (operation.parameters == null)
            {
                operation.parameters = new List<Parameter>();
            }
            operation.parameters.Add(new Parameter
            {
                name = "file",
                @in = "formData",
                required = false,
                type = "file"
            });
        }
    }
}
