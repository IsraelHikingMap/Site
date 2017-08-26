using System;
using System.Collections.Generic;
using System.Linq;
using IsraelHiking.Common;
using NetTopologySuite.Features;
using NetTopologySuite.Geometries;
using Microsoft.Extensions.Options;

namespace IsraelHiking.API.Services
{
    internal class IconColorCategory
    {
        public string Icon { get; set; }
        public string Category { get; set; }
        public string Color { get; set; }

        public IconColorCategory(): this (string.Empty)
        {
        }

        public IconColorCategory(string icon) : this(icon, Categories.NONE)
        {
        }

        public IconColorCategory(string icon, string category) : this(icon, category, "black")
        {
        }

        public IconColorCategory(string icon, string category, string color)
        {
            Icon = icon;
            Category = category;
            Color = color;
        }
    }

    internal class PropertiesData
    {
        public string Key { get; }
        public string Value { get; }
        public bool IsAnyValue { get; }
        public double SearchFactor { get; }
        public IconColorCategory IconColorCategory { get; }

        public PropertiesData(string key, string value, double searchFactor, IconColorCategory iconColorCategory = null, bool isAnyValue = false)
        {
            Key = key;
            Value = value;
            SearchFactor = searchFactor;
            IsAnyValue = isAnyValue;
            IconColorCategory = iconColorCategory ?? new IconColorCategory();
        }
    }

    ///<inheritdoc/>
    public class GeoJsonFeatureHelper : IGeoJsonFeatureHelper
    {
        private readonly ConfigurationData _options;
        private readonly List<PropertiesData> _relations;
        private readonly List<PropertiesData> _ways;
        private readonly List<PropertiesData> _nodes;

        /// <summary>
        /// Constructor
        /// </summary>
        /// <param name="optionsProvider"></param>
        public GeoJsonFeatureHelper(IOptions<ConfigurationData> optionsProvider)
        {
            _options = optionsProvider.Value;
            var ruinsIcon = new IconColorCategory
            {
                Category = Categories.HISTORIC,
                Color = "brown",
                Icon = "icon-ruins"
            };
            var springIcon = new IconColorCategory
            {
                Category = Categories.WATER,
                Color = "blue",
                Icon = "icon-tint"
            };
            var natureReserveIcon = new IconColorCategory
            {
                Icon = "icon-nature-reserve",
                Color = "green",
                Category = Categories.OTHER
            };
            var iconPicnic = new IconColorCategory
            {
                Icon = "icon-picnic",
                Color = "brown",
                Category = Categories.CAMPING
            };
            var placeIcon = new IconColorCategory("icon-home");
            _relations = new List<PropertiesData>
            {
                new PropertiesData("place", "any", 1, placeIcon, true),
                new PropertiesData("boundary", "national_park", 1, natureReserveIcon),
                new PropertiesData("boundary", "protected_area", 1, natureReserveIcon),
                new PropertiesData("leisure", "nature_reserve", 1, natureReserveIcon),
                new PropertiesData("route", "hiking", 1, new IconColorCategory("icon-hike", Categories.ROUTE_HIKE)),
                new PropertiesData("route", "bicycle", 1, new IconColorCategory("icon-bike", Categories.ROUTE_BIKE)),
                new PropertiesData("route", "mtb", 1, new IconColorCategory("icon-bike", Categories.ROUTE_BIKE)),
            };

            _ways = new List<PropertiesData>
            {
                new PropertiesData("place", "any", 1, placeIcon, true),
                new PropertiesData("waterway", "stream", 1),
                new PropertiesData("waterway", "river", 1),
                new PropertiesData("waterway", "wadi", 1),
                new PropertiesData("boundary", "national_park", 1, natureReserveIcon),
                new PropertiesData("boundary", "protected_area", 1, natureReserveIcon),
                new PropertiesData("leisure", "nature_reserve", 1, natureReserveIcon),
                new PropertiesData("historic", "ruins", 1, ruinsIcon),
                new PropertiesData("historic", "archaeological_site", 1, ruinsIcon),
                new PropertiesData("highway", "any", _options.SearchFactor, new IconColorCategory("icon-map-signs"), true)
            };

            _nodes = new List<PropertiesData>
            {
                new PropertiesData("place", "any", 1, placeIcon, true),
                new PropertiesData("landuse", "farmyard", 1),
                new PropertiesData("natural", "peak", 1, new IconColorCategory("icon-peak")),
                new PropertiesData("natural", "spring", 1, springIcon),
                new PropertiesData("natural", "tree", 1, new IconColorCategory("icon-tree", Categories.NONE, "green")),
                new PropertiesData("natural", "cave_entrance", 1, new IconColorCategory("icon-cave", Categories.NATURAL)),
                new PropertiesData("natural", "waterhole", 1, springIcon),
                new PropertiesData("water", "pond", 1, springIcon),
                new PropertiesData("man_made", "water_well", 1, ruinsIcon),
                new PropertiesData("man_made", "cistern", 1, springIcon),
                new PropertiesData("leisure", "nature_reserve", 1, natureReserveIcon),
                new PropertiesData("leisure", "picnic", 1, iconPicnic),
                new PropertiesData("leisure", "picnic_table", 1, iconPicnic),
                new PropertiesData("tourism", "picnic_site", 1, iconPicnic),
                new PropertiesData("tourism", "camp_site", 1, new IconColorCategory("icon-campsite", Categories.CAMPING)),
                new PropertiesData("tourism", "viewpoint", 1, new IconColorCategory("icon-viewpoint", Categories.VIEWPOINT)),
                new PropertiesData("tourism", "attraction", 1, new IconColorCategory("icon-star", Categories.OTHER, "orange")),
                new PropertiesData("historic", "ruins", 1, ruinsIcon),
                new PropertiesData("historic", "archaeological_site", 1, ruinsIcon),
                new PropertiesData("historic", "memorial", 1, ruinsIcon),
                new PropertiesData("historic", "monument", 1, ruinsIcon),
                new PropertiesData("highway", "bus_stop", _options.SearchFactor, new IconColorCategory("icon-bus-stop")),
                new PropertiesData("waterway", "waterfall", 1, springIcon)
            };
        }

        ///<inheritdoc/>
        public string GetIcon(Feature feature)
        {
            return FindPropertiesData(feature)?.IconColorCategory?.Icon ?? string.Empty;
        }

        ///<inheritdoc/>
        public string GetIconColor(Feature feature)
        {
            return FindPropertiesData(feature)?.IconColorCategory?.Color ?? "black";
        }

        ///<inheritdoc/>
        public double GetSearchFactor(Feature feature)
        {
            return FindPropertiesData(feature)?.SearchFactor ?? _options.SearchFactor;
        }

        ///<inheritdoc/>
        public string GetPoiCategory(Feature feature)
        {
            return FindPropertiesData(feature)?.IconColorCategory?.Category ?? Categories.NONE;
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
