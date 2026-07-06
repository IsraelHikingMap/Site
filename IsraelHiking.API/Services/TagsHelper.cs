using IsraelHiking.Common;
using NetTopologySuite.Features;
using System.Collections.Generic;

namespace IsraelHiking.API.Services;

///<inheritdoc/>
public class TagsHelper : ITagsHelper
{
    ///<inheritdoc/>
    public List<List<KeyValuePair<string, string>>> FindTagsForIcon(string icon)
    {
        var tagCombinations = new List<List<KeyValuePair<string, string>>>();

        switch (icon)
        {
            case "icon-leaf":
                tagCombinations.Add([new("boundary", "protected_area")]);
                tagCombinations.Add([new("boundary", "national_park")]);
                tagCombinations.Add([new("leisure", "nature_reserve")]);
                return tagCombinations;
            case "icon-hike":
                tagCombinations.Add([new("route", "hiking")]);
                tagCombinations.Add([new("route", "foot")]);
                tagCombinations.Add([new("highway", "footway")]);
                tagCombinations.Add([new("highway", "path")]);
                return tagCombinations;
            case "icon-bike":
                tagCombinations.Add([new("route", "bicycle")]);
                tagCombinations.Add([new("route", "mtb")]);
                tagCombinations.Add([new("highway", "cycleway")]);
                tagCombinations.Add([new("landuse", "recreation_ground"), new("sport", "mtb")]);
                return tagCombinations;
            case "icon-four-by-four":
                // route=road AND scenic=yes
                tagCombinations.Add([new("route", "road"), new("scenic", "yes")]);
                tagCombinations.Add([new("highway", "track")]);
                return tagCombinations;
            case "icon-ruins":
                tagCombinations.Add([new("historic", "ruins")]);
                return tagCombinations;
            case "icon-archaeological":
                tagCombinations.Add([new("historic", "archaeological_site")]);
                return tagCombinations;
            case "icon-memorial":
                tagCombinations.Add([new("historic", "memorial")]);
                tagCombinations.Add([new("historic", "monument")]);
                return tagCombinations;
            case "icon-cave":
                tagCombinations.Add([new("natural", "cave_entrance")]);
                tagCombinations.Add([new("historic", "tomb")]);
                return tagCombinations;
            case "icon-picnic":
                tagCombinations.Add([new("tourism", "picnic_site")]);
                tagCombinations.Add([new("leisure", "picnic_table")]);
                tagCombinations.Add([new("amenity", "picnic")]);
                return tagCombinations;
            case "icon-tint":
                tagCombinations.Add([new("natural", "spring")]);
                tagCombinations.Add([new("water", "reservoir")]);
                tagCombinations.Add([new("water", "pond")]);
                tagCombinations.Add([new("water", "lake")]);
                tagCombinations.Add([new("water", "stream_pool")]);
                return tagCombinations;
            case "icon-tree":
                tagCombinations.Add([new("natural", "tree")]);
                tagCombinations.Add([new("landuse", "forest")]);
                return tagCombinations;
            case "icon-flowers":
                tagCombinations.Add([new("natural", "flowers")]);
                return tagCombinations;
            case "icon-waterhole":
                tagCombinations.Add([new("natural", "waterhole")]);
                return tagCombinations;
            case "icon-water-well":
                tagCombinations.Add([new("man_made", "water_well")]);
                return tagCombinations;
            case "icon-cistern":
                tagCombinations.Add([new("man_made", "cistern")]);
                return tagCombinations;
            case "icon-waterfall":
                tagCombinations.Add([new("waterway", "waterfall")]);
                return tagCombinations;
            case "icon-river":
                tagCombinations.Add([new("type", "waterway")]);
                return tagCombinations;
            case "icon-home":
                tagCombinations.Add([new("place", "*")]);
                return tagCombinations;
            case "icon-viewpoint":
                tagCombinations.Add([new("tourism", "viewpoint")]);
                return tagCombinations;
            case "icon-campsite":
                tagCombinations.Add([new("tourism", "camp_site")]);
                return tagCombinations;
            case "icon-star":
                tagCombinations.Add([new("tourism", "attraction")]);
                return tagCombinations;
            case "icon-artwork":
                tagCombinations.Add([new("tourism", "artwork")]);
                return tagCombinations;
            case "icon-alpinehut":
                tagCombinations.Add([new("tourism", "alpine_hut")]);
                return tagCombinations;
            case "icon-peak":
                tagCombinations.Add([new("natural", "peak")]);
                tagCombinations.Add([new("natural", "ridge")]);
                tagCombinations.Add([new("natural", "volcano")]);
                tagCombinations.Add([new("natural", "valley")]);
                return tagCombinations;
            case "icon-inature":
                tagCombinations.Add([new(FeatureAttributes.INATURE_REF, "*")]);
                return tagCombinations;
            case "icon-synagogue":
                tagCombinations.Add([new("amenity", "place_of_worship"), new("religion", "jewish")]);
                return tagCombinations;
            case "icon-church":
                tagCombinations.Add([new("amenity", "place_of_worship"), new("religion", "christian")]);
                return tagCombinations;
            case "icon-mosque":
                tagCombinations.Add([new("amenity", "place_of_worship"), new("religion", "muslim")]);
                return tagCombinations;
            case "icon-holy-place":
                tagCombinations.Add([new("amenity", "place_of_worship")]);
                return tagCombinations;
            case "icon-bed":
                tagCombinations.Add([new("tourism", "hotel")]);
                tagCombinations.Add([new("tourism", "motel")]);
                tagCombinations.Add([new("tourism", "hostel")]);
                tagCombinations.Add([new("tourism", "chalet")]);
                tagCombinations.Add([new("tourism", "guest_house")]);
                tagCombinations.Add([new("tourism", "bed_and_breakfast")]);
                tagCombinations.Add([new("tourism", "dormitory")]);
                return tagCombinations;
            case "icon-search":
            default:
                // Default icon - could represent any unmatched tags
                return tagCombinations;
        }
    }

    ///<inheritdoc/>
    public IconColorCategory GetIconColorCategoryForTags(IAttributesTable attributes)
    {
        if ("protected_area".Equals(GetString(attributes, "boundary")) ||
            "national_park".Equals(GetString(attributes, "boundary")) ||
            "nature_reserve".Equals(GetString(attributes, "leisure")))
        {
            return new IconColorCategory
            {
                Color = "#008000",
                Icon = "icon-leaf",
                Category = Categories.OTHER
            };
        }

        if (GetString(attributes, "route") != null)
        {
            switch (GetString(attributes, "route"))
            {
                case "hiking":
                case "foot":
                    return new IconColorCategory
                    {
                        Color = "black",
                        Icon = "icon-hike",
                        Category = Categories.ROUTE_HIKE
                    };
                case "bicycle":
                case "mtb":
                    return new IconColorCategory
                    {
                        Color = "black",
                        Icon = "icon-bike",
                        Category = Categories.ROUTE_BIKE
                    };
                case "road":
                    if ("yes".Equals(GetString(attributes, "scenic")))
                    {
                        return new IconColorCategory
                        {
                            Color = "black",
                            Category = Categories.ROUTE_4X4,
                            Icon = "icon-four-by-four"
                        };
                    }
                    break;
            }
        }

        if (GetString(attributes, "historic") != null)
        {
            var category = new IconColorCategory
            {
                Color = "#666666",
                Category = Categories.HISTORIC
            };

            switch (GetString(attributes, "historic"))
            {
                case "ruins":
                    category.Icon = "icon-ruins";
                    return category;
                case "archaeological_site":
                    category.Icon = "icon-archaeological";
                    return category;
                case "memorial":
                case "monument":
                    category.Icon = "icon-memorial";
                    return category;
                case "tomb":
                    return new IconColorCategory
                    {
                        Color = "black",
                        Icon = "icon-cave",
                        Category = Categories.NATURAL
                    };
            }
        }

        if ("picnic_table".Equals(GetString(attributes, "leisure")) ||
            "picnic_site".Equals(GetString(attributes, "tourism")) ||
            "picnic".Equals(GetString(attributes, "amenity")))
        {
            return new IconColorCategory
            {
                Color = "#734a08",
                Icon = "icon-picnic",
                Category = Categories.CAMPING
            };
        }

        if (GetString(attributes, "natural") != null)
        {
            switch (GetString(attributes, "natural"))
            {
                case "cave_entrance":
                    return new IconColorCategory
                    {
                        Color = "black",
                        Icon = "icon-cave",
                        Category = Categories.NATURAL
                    };
                case "spring":
                    return new IconColorCategory
                    {
                        Color = "#1e80e3",
                        Icon = "icon-tint",
                        Category = Categories.WATER
                    };
                case "tree":
                    return new IconColorCategory
                    {
                        Color = "#008000",
                        Icon = "icon-tree",
                        Category = Categories.NATURAL
                    };
                case "flowers":
                    return new IconColorCategory
                    {
                        Color = "#008000",
                        Icon = "icon-flowers",
                        Category = Categories.NATURAL
                    };
                case "waterhole":
                    return new IconColorCategory
                    {
                        Color = "#1e80e3",
                        Icon = "icon-waterhole",
                        Category = Categories.WATER
                    };
                case "ridge":
                case "peak":
                case "volcano":
                case "valley":
                    return new IconColorCategory
                    {
                        Color = "black",
                        Icon = "icon-peak",
                        Category = Categories.NATURAL
                    };
            }
        }

        if ("reservoir".Equals(GetString(attributes, "water")) ||
            "pond".Equals(GetString(attributes, "water")) ||
            "lake".Equals(GetString(attributes, "water")) ||
            "stream_pool".Equals(GetString(attributes, "water")))
        {
            return new IconColorCategory
            {
                Color = "#1e80e3",
                Icon = "icon-tint",
                Category = Categories.WATER
            };
        }

        if (GetString(attributes, "man_made") != null)
        {
            var category = new IconColorCategory
            {
                Color = "#1e80e3",
                Category = Categories.WATER
            };

            switch (GetString(attributes, "man_made"))
            {
                case "water_well":
                    category.Icon = "icon-water-well";
                    return category;
                case "cistern":
                    category.Icon = "icon-cistern";
                    return category;
            }
        }

        if ("waterfall".Equals(GetString(attributes, "waterway")))
        {
            return new IconColorCategory
            {
                Color = "#1e80e3",
                Icon = "icon-waterfall",
                Category = Categories.WATER
            };
        }

        if (GetString(attributes, "waterway") != null || "waterway".Equals(GetString(attributes, "type")))
        {
            return new IconColorCategory
            {
                Color = "#1e80e3",
                Icon = "icon-river",
                Category = Categories.WATER
            };
        }

        if (GetString(attributes, "place") != null)
        {
            return new IconColorCategory
            {
                Color = "black",
                Icon = "icon-home",
                Category = Categories.OTHER
            };
        }

        if (GetString(attributes, "tourism") != null)
        {
            switch (GetString(attributes, "tourism"))
            {
                case "viewpoint":
                    return new IconColorCategory
                    {
                        Color = "#008000",
                        Icon = "icon-viewpoint",
                        Category = Categories.VIEWPOINT
                    };
                case "camp_site":
                    return new IconColorCategory
                    {
                        Color = "#734a08",
                        Icon = "icon-campsite",
                        Category = Categories.CAMPING
                    };
                case "attraction":
                    return new IconColorCategory
                    {
                        Color = "#ffb800",
                        Icon = "icon-star",
                        Category = Categories.OTHER
                    };
                case "artwork":
                    return new IconColorCategory
                    {
                        Color = "#ffb800",
                        Icon = "icon-artwork",
                        Category = Categories.OTHER
                    };
                case "alpine_hut":
                    return new IconColorCategory
                    {
                        Color = "#734a08",
                        Icon = "icon-alpinehut",
                        Category = Categories.CAMPING
                    };
                case "hotel":
                case "motel":
                case "hostel":
                case "chalet":
                case "guest_house":
                case "bed_and_breakfast":
                case "dormitory":
                    return new IconColorCategory
                    {
                        Color = "#734a08",
                        Icon = "icon-bed",
                        Category = Categories.OTHER
                    };
            }
        }

        if (GetString(attributes, "mtb:name") != null)
        {
            return new IconColorCategory
            {
                Color = "gray",
                Icon = "icon-bike",
                Category = Categories.ROUTE_BIKE
            };
        }


        if (GetString(attributes, "highway") != null)
        {
            switch (GetString(attributes, "highway"))
            {
                case "cycleway":
                    return new IconColorCategory
                    {
                        Color = "black",
                        Category = Categories.ROUTE_BIKE,
                        Icon = "icon-bike"
                    };
                case "footway":
                    return new IconColorCategory
                    {
                        Color = "black",
                        Category = Categories.ROUTE_HIKE,
                        Icon = "icon-hike"
                    };
                case "path":
                    return new IconColorCategory
                    {
                        Color = "black",
                        Category = Categories.ROUTE_HIKE,
                        Icon = "icon-hike"
                    };
                case "track":
                    return new IconColorCategory
                    {
                        Color = "black",
                        Category = Categories.ROUTE_4X4,
                        Icon = "icon-four-by-four"
                    };
            }
        }

        if ("place_of_worship".Equals(GetString(attributes, "amenity")) || "monastery".Equals(GetString(attributes, "amenity")))
        {
            var religion = GetString(attributes, "religion");
            return religion switch
            {
                "jewish" => new IconColorCategory
                {
                    Color = "black",
                    Icon = "icon-synagogue",
                    Category = Categories.OTHER
                },
                "christian" => new IconColorCategory
                {
                    Color = "black",
                    Icon = "icon-church",
                    Category = Categories.OTHER
                },
                "muslim" => new IconColorCategory
                {
                    Color = "black",
                    Icon = "icon-mosque",
                    Category = Categories.OTHER
                },
                _ => new IconColorCategory
                {
                    Color = "black",
                    Icon = "icon-holy-place",
                    Category = Categories.OTHER
                },
            };
        }

        if ("recreation_ground".Equals(GetString(attributes, "landuse")) && "mtb".Equals(GetString(attributes, "sport")))
        {
            return new IconColorCategory
            {
                Color = "green",
                Icon = "icon-bike",
                Category = Categories.ROUTE_BIKE
            };
        }

        if ("forest".Equals(GetString(attributes, "landuse")))
        {
            return new IconColorCategory
            {
                Color = "#008000",
                Icon = "icon-tree",
                Category = Categories.OTHER
            };
        }

        if (GetString(attributes, FeatureAttributes.INATURE_REF) != null)
        {
            return new IconColorCategory
            {
                Color = "#116C00",
                Icon = "icon-inature",
                Category = Categories.OTHER
            };
        }

        if (GetString(attributes, "wikidata") != null || GetString(attributes, "wikipedia") != null)
        {
            return new IconColorCategory
            {
                Color = "black",
                Icon = "icon-wikipedia-w",
                Category = Categories.OTHER
            };
        }

        return new IconColorCategory
        {
            Color = "black",
            Icon = "icon-search",
            Category = Categories.OTHER
        };
    }

    private string GetString(IAttributesTable attributes, string key)
    {
        if (attributes.Exists(key))
        {
            var value = attributes[key];
            return value?.ToString();
        }
        return null;
    }
}