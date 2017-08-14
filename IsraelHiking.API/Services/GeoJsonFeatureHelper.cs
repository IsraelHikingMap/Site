using System;
using System.Collections.Generic;
using System.Linq;
using IsraelHiking.Common;
using NetTopologySuite.Features;
using NetTopologySuite.Geometries;
using Microsoft.Extensions.Options;

namespace IsraelHiking.API.Services
{
    internal class PropertiesData
    {
        public string Key { get; }
        public string Value { get; }
        public bool IsAnyValue { get; }
        public double SearchFactor { get; }
        public string Icon { get; }
        public string PoiType { get; }

        public PropertiesData(string key, string value, double searchFactor, string icon = "", bool isAnyValue = false, string poiType = "none")
        {
            Key = key;
            Value = value;
            SearchFactor = searchFactor;
            IsAnyValue = isAnyValue;
            Icon = icon;
            PoiType = poiType;
        }
    }

    ///<inheritdoc/>
    public class GeoJsonFeatureHelper : IGeoJsonFeatureHelper
    {
        private readonly List<PropertiesData> _relations;
        private readonly List<PropertiesData> _ways; 
        private readonly List<PropertiesData> _nodes;

        /// <summary>
        /// Constructor
        /// </summary>
        /// <param name="optionsProvider"></param>
        public GeoJsonFeatureHelper(IOptions<ConfigurationData> optionsProvider)
        {
            // HM TODO: change images to font icons.
            var options = optionsProvider.Value;
            _relations = new List<PropertiesData>
            {
                new PropertiesData("place", "any", 1, "http://www.sjjb.co.uk/mapicons/png/accommodation_youth_hostel.p.24.png", true),
                new PropertiesData("boundary", "national_park", 1, "http://www.sjjb.co.uk/mapicons/png/landuse_grass.n.16.png"),
                new PropertiesData("boundary", "protected_area", 1),
                new PropertiesData("leisure", "nature_reserve", 1, "http://www.sjjb.co.uk/mapicons/png/landuse_grass.n.16.png"),
                new PropertiesData("route", "hiking", 1, "https://israelhiking.osm.org.il/content/images/hike.svg"),
                new PropertiesData("route", "bicycle", 1, "https://israelhiking.osm.org.il/content/images/bike.svg"),
                new PropertiesData("route", "mtb", 1, "https://israelhiking.osm.org.il/content/images/bike.svg"),
            };

            _ways = new List<PropertiesData>
            {
                new PropertiesData("place", "any", 1, "http://www.sjjb.co.uk/mapicons/png/accommodation_youth_hostel.p.24.png", true),
                new PropertiesData("waterway", "stream", 1),
                new PropertiesData("waterway", "river", 1),
                new PropertiesData("waterway", "wadi", 1),
                new PropertiesData("boundary", "national_park", 1, "http://www.sjjb.co.uk/mapicons/png/landuse_grass.n.16.png", false, "other"),
                new PropertiesData("boundary", "protected_area", 1),
                new PropertiesData("leisure", "nature_reserve", 1, "http://www.sjjb.co.uk/mapicons/png/landuse_grass.n.16.png", false, "other"),
                new PropertiesData("historic", "archaeological_site", 1, "http://www.sjjb.co.uk/mapicons/png/tourist_archaeological2.p.16.png", false, "ruins"),
                new PropertiesData("highway", "any", options.SearchFactor, "https://raw.githubusercontent.com/IsraelHikingMap/Map/master/Icons/mtbmap/sign.png", true)
            };

            _nodes = new List<PropertiesData>
            {
                new PropertiesData("place", "any", 1, "http://www.sjjb.co.uk/mapicons/png/accommodation_youth_hostel.p.24.png", true),
                new PropertiesData("landuse", "farmyard", 1),
                new PropertiesData("natural", "peak", 1, "https://raw.githubusercontent.com/IsraelHikingMap/Map/master/Icons/mtbmap/peak.png"),
                new PropertiesData("natural", "spring", 1, "https://raw.githubusercontent.com/IsraelHikingMap/Map/master/Icons/mtbmap/spring.png", false, "spring"),
                new PropertiesData("natural", "tree", 1, "https://raw.githubusercontent.com/IsraelHikingMap/Map/master/Icons/mtbmap/tree.png"),
                new PropertiesData("natural", "cave_entrance", 1, "http://www.sjjb.co.uk/mapicons/png/poi_cave.glow.32.png", false, "other"),
                new PropertiesData("natural", "waterhole", 1, "https://raw.githubusercontent.com/IsraelHikingMap/Map/master/Icons/mtbmap/water_hole.png", false, "spring"),
                new PropertiesData("water", "pond", 1, "", false, "spring"),
                new PropertiesData("man_made", "water_well", 1, "https://raw.githubusercontent.com/IsraelHikingMap/Map/master/Icons/mtbmap/well.png", false, "ruins"),
                new PropertiesData("man_made", "cistern", 1, "https://raw.githubusercontent.com/IsraelHikingMap/Map/master/Icons/mtbmap/cistern.png", false, "ruins"),
                new PropertiesData("leisure", "picnic", 1, "http://www.sjjb.co.uk/mapicons/png/tourist_picnic.n.16.png", false, "other"),
                new PropertiesData("leisure", "picnic_table", 1, "http://www.sjjb.co.uk/mapicons/png/tourist_picnic.n.16.png", false, "other"),
                new PropertiesData("leisure", "nature_reserve", 1, "http://www.sjjb.co.uk/mapicons/png/landuse_grass.n.16.png", false, "other"),
                new PropertiesData("tourism", "picnic_site", 1, "http://www.sjjb.co.uk/mapicons/png/tourist_picnic.n.16.png", false, "other"),
                new PropertiesData("tourism", "camp_site", 1, "http://www.sjjb.co.uk/mapicons/png/accommodation_camping.n.16.png", false, "campsite"),
                new PropertiesData("tourism", "viewpoint", 1, "https://raw.githubusercontent.com/IsraelHikingMap/Map/master/Icons/mtbmap/viewpoint.png", false, "viewpoint"),
                new PropertiesData("tourism", "attraction", 1, "http://www.sjjb.co.uk/mapicons/png/tourist_attraction.p.16.png", false, "other"),
                new PropertiesData("historic", "ruins", 1, "https://raw.githubusercontent.com/IsraelHikingMap/Map/master/Icons/mtbmap/ruins.png", false, "ruins"),
                new PropertiesData("historic", "archaeological_site", 1, "http://www.sjjb.co.uk/mapicons/png/tourist_archaeological2.p.16.png", false, "ruins"),
                new PropertiesData("historic", "memorial", 1, "http://www.sjjb.co.uk/mapicons/png/tourist_memorial.p.16.png", false, "ruins"),
                new PropertiesData("historic", "monument", 1, "https://raw.githubusercontent.com/IsraelHikingMap/Map/master/Icons/mtbmap/monument.png", false, "ruins"),
                new PropertiesData("highway", "bus_stop", options.SearchFactor, "http://www.sjjb.co.uk/mapicons/png/transport_bus_stop2.p.16.png"),
                new PropertiesData("waterway", "waterfall", 1, "https://raw.githubusercontent.com/IsraelHikingMap/Map/master/Icons/mtbmap/waterfall.png", false, "spring")
            };
        }

        ///<inheritdoc/>
        public string GetIcon(Feature feature)
        {
            return FindPropertiesData(feature)?.Icon ?? string.Empty;
        }

        ///<inheritdoc/>
        public double? GetSearchFactor(Feature feature)
        {
            return FindPropertiesData(feature)?.SearchFactor;
        }

        ///<inheritdoc/>
        public string GetPoiType(Feature feature)
        {
            return FindPropertiesData(feature)?.PoiType ?? "none";
        }

        private PropertiesData FindPropertiesData(Feature feature)
        {
            PropertiesData data = null;
            if (feature.Geometry is MultiPolygon || feature.Geometry is MultiLineString)
            {
                data = FindPropertiesData(feature.Attributes, _relations);
            }
            if (feature.Geometry is LineString || feature.Geometry is Polygon)
            {
                data = FindPropertiesData(feature.Attributes, _ways);
            }
            if (feature.Geometry is Point)
            {
                data = FindPropertiesData(feature.Attributes, _nodes);
            }
            return data;
        }

        private PropertiesData FindPropertiesData(IAttributesTable attributesTable, List<PropertiesData> priorityData)
        {
            return attributesTable.GetNames().Select(key => priorityData.FirstOrDefault(p =>
            {
                if (key.Equals(p.Key, StringComparison.OrdinalIgnoreCase) == false)
                {
                    return false;
                }
                return p.IsAnyValue || attributesTable[key].ToString().Equals(p.Value, StringComparison.CurrentCultureIgnoreCase);
            })).FirstOrDefault(data => data != null);
        }
    }
}
