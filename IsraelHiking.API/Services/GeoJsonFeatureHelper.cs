using System;
using System.Collections.Generic;
using System.Diagnostics.CodeAnalysis;
using System.Linq;
using NetTopologySuite.Features;
using NetTopologySuite.Geometries;

namespace IsraelHiking.API.Services
{
    public class PropertiesData
    {
        public const double DEFAULT_SEARCH_FACTOR = 0.5;

        public string Key { get; }
        public string Value { get; }
        public bool IsAnyValue { get; }
        public double SearchFactor { get; }
        public string Icon { get; }

        public PropertiesData(string key, string value, double searchFactor, string icon = "", bool isAnyValue = false)
        {
            Key = key;
            Value = value;
            SearchFactor = searchFactor;
            IsAnyValue = isAnyValue;
            Icon = icon;
        }
    }

    [ExcludeFromCodeCoverage]
    public static class GeoJsonFeatureHelper
    {
        private static readonly List<PropertiesData> Relations = new List<PropertiesData>
        {
            new PropertiesData("place", "any", 1, "https://raw.githubusercontent.com/IsraelHikingMap/Map/master/Icons/mtbmap/hut.png", true),
            new PropertiesData("boundary", "national_park", 1, "http://www.sjjb.co.uk/mapicons/png/landuse_grass.n.16.png"),
            new PropertiesData("boundary", "protected_area", 1),
            new PropertiesData("leisure", "nature_reserve", 1, "http://www.sjjb.co.uk/mapicons/png/landuse_grass.n.16.png"),
            new PropertiesData("route", "hiking", 1, "https://raw.githubusercontent.com/IsraelHikingMap/Map/master/Icons/mtbmap/hiker.png"),
            new PropertiesData("route", "bicycle", 1, "https://raw.githubusercontent.com/IsraelHikingMap/Map/master/Icons/mtbmap/bike.png"),
            new PropertiesData("route", "mtb", 1, "https://raw.githubusercontent.com/IsraelHikingMap/Map/master/Icons/mtbmap/bike.png"),
            new PropertiesData("waterway", "waterfall", 1, "https://raw.githubusercontent.com/IsraelHikingMap/Map/master/Icons/mtbmap/waterfall.png")
        };

        private static readonly List<PropertiesData> Ways = new List<PropertiesData>
        {
            new PropertiesData("place", "any", 1, "https://raw.githubusercontent.com/IsraelHikingMap/Map/master/Icons/mtbmap/hut.png", true),
            new PropertiesData("waterway", "stream", 1),
            new PropertiesData("waterway", "river", 1),
            new PropertiesData("waterway", "wadi", 1),
            new PropertiesData("boundary", "national_park", 1, "http://www.sjjb.co.uk/mapicons/png/landuse_grass.n.16.png"),
            new PropertiesData("boundary", "protected_area", 1),
            new PropertiesData("leisure", "nature_reserve", 1, "http://www.sjjb.co.uk/mapicons/png/landuse_grass.n.16.png"),
            new PropertiesData("historic", "archaeological_site", 1, "http://www.sjjb.co.uk/mapicons/png/tourist_archaeological2.p.16.png"),
            new PropertiesData("highway", "any", PropertiesData.DEFAULT_SEARCH_FACTOR, "https://raw.githubusercontent.com/IsraelHikingMap/Map/master/Icons/mtbmap/sign.png", true)
        };

        private static readonly List<PropertiesData> Nodes = new List<PropertiesData>
        {
            new PropertiesData("place", "any", 1, "https://raw.githubusercontent.com/IsraelHikingMap/Map/master/Icons/mtbmap/hut.png", true),
            new PropertiesData("landuse", "farmyard", 1),
            new PropertiesData("natural", "peak", 1, "https://raw.githubusercontent.com/IsraelHikingMap/Map/master/Icons/mtbmap/peak.png"),
            new PropertiesData("natural", "spring", 1, "https://raw.githubusercontent.com/IsraelHikingMap/Map/master/Icons/mtbmap/spring.png"),
            new PropertiesData("natural", "tree", 1, "https://raw.githubusercontent.com/IsraelHikingMap/Map/master/Icons/mtbmap/tree.png"),
            new PropertiesData("natural", "cave_entrance", 1, "https://raw.githubusercontent.com/IsraelHikingMap/Map/master/Icons/mtbmap/cave_entrence.png"),
            new PropertiesData("natural", "waterhole", 1, "https://raw.githubusercontent.com/IsraelHikingMap/Map/master/Icons/mtbmap/water_hole.png"),
            new PropertiesData("water", "pond", 1),
            new PropertiesData("man_made", "water_well", 1, "https://raw.githubusercontent.com/IsraelHikingMap/Map/master/Icons/mtbmap/well.png"),
            new PropertiesData("man_made", "cistern", 1, "https://raw.githubusercontent.com/IsraelHikingMap/Map/master/Icons/mtbmap/cistern.png"),
            new PropertiesData("leisure", "picnic", 1, "http://www.sjjb.co.uk/mapicons/png/tourist_picnic.n.16.png"),
            new PropertiesData("leisure", "picnic_table", 1, "http://www.sjjb.co.uk/mapicons/png/tourist_picnic.n.16.png"),
            new PropertiesData("leisure", "nature_reserve", 1, "http://www.sjjb.co.uk/mapicons/png/landuse_grass.n.16.png"),
            new PropertiesData("tourism", "picnic_site", 1, "http://www.sjjb.co.uk/mapicons/png/tourist_picnic.n.16.png"),
            new PropertiesData("tourism", "camp_site", 1, "http://www.sjjb.co.uk/mapicons/png/accommodation_camping.n.16.png"),
            new PropertiesData("tourism", "viewpoint", 1, "https://raw.githubusercontent.com/IsraelHikingMap/Map/master/Icons/mtbmap/viewpoint.png"),
            new PropertiesData("tourism", "attraction", 1, "http://www.sjjb.co.uk/mapicons/png/tourist_attraction.p.16.png"),
            new PropertiesData("historic", "ruins", 1, "https://raw.githubusercontent.com/IsraelHikingMap/Map/master/Icons/mtbmap/ruins.png"),
            new PropertiesData("historic", "archaeological_site", 1, "http://www.sjjb.co.uk/mapicons/png/tourist_archaeological2.p.16.png"),
            new PropertiesData("historic", "memorial", 1, "http://www.sjjb.co.uk/mapicons/png/tourist_memorial.p.16.png"),
            new PropertiesData("historic", "monument", 1, "https://raw.githubusercontent.com/IsraelHikingMap/Map/master/Icons/mtbmap/monument.png"),
            new PropertiesData("highway", "bus_stop", PropertiesData.DEFAULT_SEARCH_FACTOR, "http://www.sjjb.co.uk/mapicons/png/transport_bus_stop2.p.16.png"),
        };

        public static PropertiesData FindPropertiesData(Feature feature)
        {
            PropertiesData data = null;
            if (feature.Geometry is MultiPolygon || feature.Geometry is MultiLineString)
            {
                data = FindPropertiesData(feature.Attributes, Relations);
            }
            if (feature.Geometry is LineString || feature.Geometry is Polygon)
            {
                data = FindPropertiesData(feature.Attributes, Ways);
            }
            if (feature.Geometry is Point)
            {
                data = FindPropertiesData(feature.Attributes, Nodes);
            }
            return data;
        }

        private static PropertiesData FindPropertiesData(IAttributesTable attributesTable, List<PropertiesData> priorityData)
        {
            return attributesTable.GetNames().Select(key => priorityData.FirstOrDefault(p =>
            {
                if (key.Equals(p.Key, StringComparison.InvariantCultureIgnoreCase) == false)
                {
                    return false;
                }
                return p.IsAnyValue || attributesTable[key].ToString().Equals(p.Value, StringComparison.CurrentCultureIgnoreCase);
            })).FirstOrDefault(data => data != null);
        }
    }
}
