using System;
using System.Collections.ObjectModel;
using GeoAPI.Geometries;
using NetTopologySuite.Features;
using NetTopologySuite.Geometries;
using NetTopologySuite.IO;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;
using Swashbuckle.Swagger;

namespace IsraelHiking.API.Swagger
{
    /// <summary>
    /// Provides example for feature collection in swagger API
    /// </summary>
    public class FeatureCollectionExampleFilter : ISchemaFilter
    {
        /// <summary>
        /// Checks and updates the schema if the relevant type is found
        /// </summary>
        /// <param name="schema">The schema</param>
        /// <param name="schemaRegistry">The schema registry</param>
        /// <param name="type">The type</param>
        public void Apply(Schema schema, SchemaRegistry schemaRegistry, Type type)
        {
            if (type != typeof(FeatureCollection))
            {
                return;
            }
            var writer = new GeoJsonWriter();
            var exampleFeatureCollectionString = writer.Write(
                new FeatureCollection(new Collection<IFeature>
                {
                    new Feature(new LineString(new[]
                        {
                            new Coordinate(1, 2),
                            new Coordinate(3, 4),
                        }),
                        new AttributesTable())
                }));
            var jsonObject = JsonConvert.DeserializeObject<JObject>(exampleFeatureCollectionString);
            schema.example = jsonObject;
            schema.@default = jsonObject;
        }
    }
}