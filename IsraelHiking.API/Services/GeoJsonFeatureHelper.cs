using System;
using System.Collections.Generic;
using System.Linq;
using GeoJSON.Net.Feature;
using GeoJSON.Net.Geometry;

namespace IsraelHiking.API.Services
{
    public class PropertiesData
    {
        public string Key { get; }
        public string Value { get; }
        public bool IsAnyValue { get; }
        public int SortOrder { get; }
        public string Icon { get; }

        public PropertiesData(string key, string value, int sortOrder, string icon = "", bool isAnyValue = false)
        {
            Key = key;
            Value = value;
            SortOrder = sortOrder;
            IsAnyValue = isAnyValue;
            Icon = icon;
        }
    }

    public static class GeoJsonFeatureHelper
    {
        private static readonly List<PropertiesData> Relations = new List<PropertiesData>
        {
            new PropertiesData("boundary", "national_park", 1, "http://www.sjjb.co.uk/mapicons/png/landuse_grass.n.16.png"),
            new PropertiesData("boundary", "protected_area", 1),
            new PropertiesData("leisure", "nature_reserve", 1, "http://www.sjjb.co.uk/mapicons/png/landuse_grass.n.16.png"),
            new PropertiesData("route", "hiking", 1, "http://www.sjjb.co.uk/mapicons/png/transport_walking.n.16.png"),
            new PropertiesData("route", "bicycle", 1, "http://www.sjjb.co.uk/mapicons/png/shopping_bicycle.n.16.png"),
            new PropertiesData("route", "mtb", 1, "http://www.sjjb.co.uk/mapicons/png/shopping_bicycle.n.16.png")
        };

        private static readonly List<PropertiesData> Ways = new List<PropertiesData>
        {
            new PropertiesData("waterway", "stream", 1),
            new PropertiesData("waterway", "river", 1),
            new PropertiesData("waterway", "wadi", 1),
            new PropertiesData("boundary", "national_park", 1, "http://www.sjjb.co.uk/mapicons/png/landuse_grass.n.16.png"),
            new PropertiesData("boundary", "protected_area", 1),
            new PropertiesData("leisure", "nature_reserve", 1, "http://www.sjjb.co.uk/mapicons/png/landuse_grass.n.16.png")
        };

        private static readonly List<PropertiesData> Nodes = new List<PropertiesData>
        {
            new PropertiesData("place", "any", 1, "http://www.sjjb.co.uk/mapicons/png/accommodation_alpinehut.p.16.png", true),
            new PropertiesData("landuse", "farmyard", 1),
            new PropertiesData("natural", "peak", 1, "http://www.sjjb.co.uk/mapicons/png/poi_peak2.p.16.png"),
            new PropertiesData("natural", "spring", 1),
            new PropertiesData("natural", "tree", 1, "http://www.sjjb.co.uk/mapicons/png/landuse_deciduous.n.16.png"),
            new PropertiesData("natural", "cave_entrance", 1, "http://www.sjjb.co.uk/mapicons/png/poi_cave.p.16.png"),
            new PropertiesData("natural", "waterhole", 1),
            new PropertiesData("water", "pond", 1),
            new PropertiesData("man_made", "water_well", 1),
            new PropertiesData("man_made", "cistern", 1),
            new PropertiesData("leisure", "picnic", 1, "http://www.sjjb.co.uk/mapicons/png/tourist_picnic.n.16.png"),
            new PropertiesData("leisure", "picnic_table", 1, "http://www.sjjb.co.uk/mapicons/png/tourist_picnic.n.16.png"),
            new PropertiesData("tourism", "picnic_site", 1, "http://www.sjjb.co.uk/mapicons/png/tourist_picnic.n.16.png"),
            new PropertiesData("tourism", "camp_site", 1, "http://www.sjjb.co.uk/mapicons/png/accommodation_camping.n.16.png"),
            new PropertiesData("tourism", "viewpoint", 1, "http://www.sjjb.co.uk/mapicons/png/tourist_view_point.p.16.png"),
            new PropertiesData("tourism", "attraction", 1, "http://www.sjjb.co.uk/mapicons/png/tourist_attraction.p.16.png"),
            new PropertiesData("historic", "ruins", 1, "http://www.sjjb.co.uk/mapicons/png/tourist_ruin.p.16.png"),
            new PropertiesData("historic", "archaeological_site", 1, "http://www.sjjb.co.uk/mapicons/png/tourist_archaeological2.p.16.png"),
            new PropertiesData("historic", "memorial", 1, "http://www.sjjb.co.uk/mapicons/png/tourist_memorial.p.16.png"),
            new PropertiesData("historic", "monument", 1, "http://www.sjjb.co.uk/mapicons/png/tourist_monument.p.16.png"),
        };

        public static PropertiesData FindPropertiesData(Feature feature)
        {
            PropertiesData data = null;
            if (feature.Geometry is MultiPolygon || feature.Geometry is MultiLineString)
            {
                data = FindPropertiesData(feature.Properties, Relations);
            }
            if (feature.Geometry is LineString || feature.Geometry is Polygon)
            {
                data = FindPropertiesData(feature.Properties, Ways);
            }
            if (feature.Geometry is Point)
            {
                data = FindPropertiesData(feature.Properties, Nodes);
            }
            return data;
        }

        private static PropertiesData FindPropertiesData(Dictionary<string, object> properties, List<PropertiesData> priorityData)
        {
            return properties.Select(pair => priorityData.FirstOrDefault(p =>
            {
                if (pair.Key.Equals(p.Key, StringComparison.InvariantCultureIgnoreCase) == false)
                {
                    return false;
                }
                return p.IsAnyValue || pair.Value.ToString().Equals(p.Value, StringComparison.CurrentCultureIgnoreCase);
            })).FirstOrDefault(data => data != null);
        }
    }
}
