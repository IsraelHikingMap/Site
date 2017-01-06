using System;
using GeoAPI.Geometries;
using NetTopologySuite.Features;
using NetTopologySuite.Geometries;
using NetTopologySuite.IO;
using Newtonsoft.Json;
using Swashbuckle.Swagger;

namespace IsraelHiking.API.Swagger
{
    /// <summary>
    /// Provides example for feature in swagger API
    /// </summary>
    public class FeatureExampleFilter : ISchemaFilter
    {
        /// <summary>
        /// Checks and updates the schema if the relevant type is found
        /// </summary>
        /// <param name="schema">The schema</param>
        /// <param name="schemaRegistry">The schema registry</param>
        /// <param name="type">The type</param>
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