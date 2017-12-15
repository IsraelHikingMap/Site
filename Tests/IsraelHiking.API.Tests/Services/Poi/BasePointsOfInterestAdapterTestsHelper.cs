using GeoAPI.Geometries;
using IsraelHiking.Common;
using NetTopologySuite.Features;
using NetTopologySuite.Geometries;

namespace IsraelHiking.API.Tests.Services.Poi
{
    public abstract class BasePointsOfInterestAdapterTestsHelper
    {
        protected Feature GetValidFeature(string poiId, string source)
        {
            return new Feature
            {
                Geometry = new LineString(new[]
                {
                    new Coordinate(0, 0),
                    new Coordinate(1, 1),
                }),
                Attributes = new AttributesTable
                {
                    {FeatureAttributes.POI_CATEGORY, FeatureAttributes.POI_CATEGORY},
                    {FeatureAttributes.NAME, FeatureAttributes.NAME},
                    {FeatureAttributes.ID, poiId},
                    {FeatureAttributes.POI_SOURCE, source},
                    {FeatureAttributes.ICON, FeatureAttributes.ICON},
                    {FeatureAttributes.ICON_COLOR, FeatureAttributes.ICON_COLOR},
                    {FeatureAttributes.OSM_TYPE, "way" },
                    {
                        FeatureAttributes.GEOLOCATION, new AttributesTable
                        {
                            {FeatureAttributes.LAT, 1.1},
                            {FeatureAttributes.LON, 2.2}
                        }
                    }
                }
            };
        }
    }
}
