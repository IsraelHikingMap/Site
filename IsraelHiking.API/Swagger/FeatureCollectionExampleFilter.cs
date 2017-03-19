using System.Collections.ObjectModel;
using GeoAPI.Geometries;
using NetTopologySuite.Features;
using NetTopologySuite.Geometries;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;
using Swashbuckle.AspNetCore.SwaggerGen;
using Swashbuckle.AspNetCore.Swagger;

namespace IsraelHiking.API.Swagger
{
    /// <summary>
    /// Provides example for feature collection in swagger API
    /// </summary>
    public class FeatureCollectionExampleFilter : ISchemaFilter
    {
        public void Apply(Schema model, SchemaFilterContext context)
        {
            if (context == null)
            {
                return;
            }
            if (context.SystemType != typeof(FeatureCollection))
            {
                return;
            }
            //var writer = new GeoJsonWriter();
            //var exampleFeatureCollectionString = writer.Write(
            //    new FeatureCollection(new Collection<IFeature>
            //    {
            //        new Feature(new LineString(new[]
            //            {
            //                new Coordinate(1, 2),
            //                new Coordinate(3, 4),
            //            }),
            //            new AttributesTable())
            //    }));
            //var jsonObject = JsonConvert.DeserializeObject<JObject>(exampleFeatureCollectionString);
            //model.Example = jsonObject;
            //model.Default = jsonObject;
        }
    }
}