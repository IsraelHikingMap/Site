using System;
using GeoAPI.Geometries;
using NetTopologySuite.Features;
using NetTopologySuite.Geometries;
using NetTopologySuite.IO;
using Newtonsoft.Json;
using Swashbuckle.Swagger;

namespace IsraelHiking.API.Swagger
{
    public class FeatureExampleFilter : ISchemaFilter
    {
        public void Apply(Schema schema, SchemaRegistry schemaRegistry, Type type)
        {
            if (type != typeof(Feature))
            {
                return;
            }
            var writer = new GeoJsonWriter();
            var exampleFeatureString = writer.Write(
                new Feature(new LineString(new[]
                    {
                        new Coordinate(1, 2),
                        new Coordinate(3, 4),
                    }),
                    new AttributesTable())
            );
            schema.example = JsonConvert.DeserializeObject(exampleFeatureString);
            schema.@default = JsonConvert.DeserializeObject(exampleFeatureString);
        }
    }
}