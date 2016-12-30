using System.Web.Http.Description;
using Swashbuckle.Swagger;

namespace IsraelHiking.API.Swagger
{
    public class OptionalFileUploadParams : IOperationFilter
    {
        public void Apply(Operation operation, SchemaRegistry schemaRegistry, ApiDescription apiDescription)
        {
            operation.consumes.Add("application/form-data");
            operation.parameters = new[]
            {
                new Parameter
                {
                    name = "file",
                    @in = "formData",
                    required = false,
                    type = "file"
                }
            };
        }
    }
}
