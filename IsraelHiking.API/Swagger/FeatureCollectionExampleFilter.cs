using System;
using System.Collections.ObjectModel;
using GeoAPI.Geometries;
using NetTopologySuite.Features;
using NetTopologySuite.Geometries;
using NetTopologySuite.IO;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;
using Newtonsoft.Json.Serialization;
using Swashbuckle.Swagger;

namespace IsraelHiking.API.Swagger
{
    public class FeatureCollectionExampleFilter : ISchemaFilter
    {
        private readonly DefaultContractResolver _contractResolver;

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