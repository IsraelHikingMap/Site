using IsraelHiking.Common;
using NetTopologySuite.Features;
using System;
using System.Collections.Generic;
using System.Linq;

namespace IsraelHiking.API.Services;

///<inheritdoc/>
public class TagsHelper : ITagsHelper
{
    private readonly List<Category> _categories;

    /// <summary>
    /// Constructor
    /// </summary>
    public TagsHelper()
    {
        _categories = [];
        // ORDER IS IMPORTANT FOR UI //
        _categories.Add(CreateWaterCategory());
        _categories.Add(CreateHistoricCategory());
        _categories.Add(CreateViewpointCategory());
        _categories.Add(CreateCampingCategory());
        _categories.Add(CreateNaturalCategory());
        _categories.Add(CreateOthersCategory());
        _categories.AddRange(CreateRoutesCategories());
    }

    private Category CreateWaterCategory()
    {
        var waterCategory = new Category
        {
            Color = "#1e80e3",
            Icon = "icon-tint",
            Name = Categories.WATER
        };
        var springIcon = new IconColorCategory
        {
            Category = Categories.WATER,
            Color = "#1e80e3",
            Icon = "icon-tint",
            Label = "Spring, Pond"
        };
        waterCategory.Items.Add(new IconAndTags(springIcon, [
            new("natural", "spring"),
            new("water", "pond"),
            new("water", "reservoir")
        ]));
        var waterfallIcon = new IconColorCategory
        {
            Category = Categories.WATER,
            Color = "#1e80e3",
            Icon = "icon-waterfall",
            Label = "Waterfall"
        };
        waterCategory.Items.Add(new IconAndTags(waterfallIcon, "waterway", "waterfall"));
        var waterHole = new IconColorCategory
        {
            Category = Categories.WATER,
            Color = "#1e80e3",
            Icon = "icon-waterhole",
            Label = "Waterhole"
        };
        waterCategory.Items.Add(new IconAndTags(waterHole, "natural", "waterhole"));
        var waterWell = new IconColorCategory
        {
            Category = Categories.WATER,
            Color = "#1e80e3",
            Icon = "icon-water-well",
            Label = "Water Well"
        };
        waterCategory.Items.Add(new IconAndTags(waterWell, "man_made", "water_well"));
        var cistern = new IconColorCategory
        {
            Category = Categories.WATER,
            Color = "#1e80e3",
            Icon = "icon-cistern",
            Label = "Cistern"
        };
        waterCategory.Items.Add(new IconAndTags(cistern, "man_made", "cistern"));
        return waterCategory;
    }

    private Category CreateHistoricCategory()
    {
        var historicCategory = new Category
        {
            Color = "#666666",
            Icon = "icon-ruins",
            Name = Categories.HISTORIC
        };
        var ruinsIcon = new IconColorCategory
        {
            Category = Categories.HISTORIC,
            Color = "#666666",
            Icon = "icon-ruins",
            Label = "Ruins"
        };
        historicCategory.Items.Add(new IconAndTags(ruinsIcon, "historic", "ruins"));
        var archaeologicalSiteIcon = new IconColorCategory
        {
            Category = Categories.HISTORIC,
            Color = "#666666",
            Icon = "icon-archaeological",
            Label = "Archaeological Site"
        };
        historicCategory.Items.Add(new IconAndTags(archaeologicalSiteIcon, "historic", "archaeological_site"));
        var memorialIcon = new IconColorCategory
        {
            Category = Categories.HISTORIC,
            Color = "#666666",
            Icon = "icon-memorial",
            Label = "Memorial"
        };
        historicCategory.Items.Add(new IconAndTags(memorialIcon, [
            new("historic", "memorial"),
            new("historic", "monument")
        ]));
        return historicCategory;
    }

    private Category CreateViewpointCategory()
    {
        var viewPointCategory = new Category
        {
            Icon = "icon-viewpoint",
            Color = "#008000",
            Name = Categories.VIEWPOINT
        };
        var viewpointIcon = new IconColorCategory("icon-viewpoint", Categories.VIEWPOINT, "#008000", "Viewpoint");
        viewPointCategory.Items.Add(new IconAndTags(viewpointIcon, "tourism", "viewpoint"));

        return viewPointCategory;
    }

    private Category CreateCampingCategory()
    {
        var campingCategory = new Category
        {
            Color = "#734a08",
            Icon = "icon-picnic",
            Name = Categories.CAMPING
        };
        var iconPicnic = new IconColorCategory
        {
            Icon = "icon-picnic",
            Color = "#734a08",
            Category = Categories.CAMPING,
            Label = "Picnic Area"
        };
        campingCategory.Items.Add(new IconAndTags(iconPicnic, [
            new("tourism", "picnic_site"),
            new("leisure", "picnic"),
            new("leisure", "picnic_table")
        ]));
        var campsiteIcon = new IconColorCategory("icon-campsite", Categories.CAMPING, "#734a08", "Campsite");
        campingCategory.Items.Add(new IconAndTags(campsiteIcon, "tourism", "camp_site"));
        return campingCategory;
    }

    private Category CreateNaturalCategory()
    {
        var naturalCategory = new Category
        {
            Color = "#008000",
            Name = Categories.NATURAL,
            Icon = "icon-tree"
        };
        var caveIcon = new IconColorCategory("icon-cave", Categories.NATURAL, "black", "Cave");
        naturalCategory.Items.Add(new IconAndTags(caveIcon, [
            new("natural", "cave_entrance"),
            new("historic", "tomb")
        ]));

        var treeIcon = new IconColorCategory("icon-tree", Categories.NATURAL, "#008000", "Tree");
        naturalCategory.Items.Add(new IconAndTags(treeIcon, "natural", "tree"));

        var flowersIcon = new IconColorCategory("icon-flowers", Categories.NATURAL, "#008000", "Flowers");
        naturalCategory.Items.Add(new IconAndTags(flowersIcon, "natural", "flowers"));

        return naturalCategory;
    }

    private Category CreateOthersCategory()
    {
        var otherCategory = new Category
        {
            Color = "#ffb800",
            Icon = "icon-star",
            Name = Categories.OTHER
        };

        var attractionIcon = new IconColorCategory("icon-star", Categories.OTHER, "#ffb800", "Attraction");
        otherCategory.Items.Add(new IconAndTags(attractionIcon, "tourism", "attraction"));
        var natureReserveIcon = new IconColorCategory
        {
            Icon = "icon-leaf",
            Color = "#008000",
            Category = Categories.OTHER,
            Label = "Nature Reserve, National Park"
        };
        otherCategory.Items.Add(new IconAndTags(natureReserveIcon,
        [
            new("boundary", "protected_area"),
            new("leisure", "nature_reserve"),
            new("boundary", "national_park")
        ]));

        return otherCategory;
    }

    private Category[] CreateRoutesCategories()
    {
        var hikeCategory = new Category
        {
            Color = "black",
            Icon = "icon-hike",
            Name = Categories.ROUTE_HIKE
        };
        var hikeIcon = new IconColorCategory("icon-hike", Categories.ROUTE_HIKE);
        hikeCategory.Items.Add(new IconAndTags(hikeIcon, [new("route", "hiking")]));
        var bikeCategory = new Category
        {
            Color = "black",
            Icon = "icon-bike",
            Name = Categories.ROUTE_BIKE
        };
        var bikeIcon = new IconColorCategory("icon-bike", Categories.ROUTE_BIKE);
        bikeCategory.Items.Add(new IconAndTags(bikeIcon, [
            new("route", "bicycle"),
            new("route", "mtb")
        ]));
        var fourWheelDriveCategory = new Category
        {
            Color = "black",
            Icon = "icon-four-by-four",
            Name = Categories.ROUTE_4X4
        };
        return
        [
            hikeCategory,
            bikeCategory,
            fourWheelDriveCategory
        ];
    }

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
                tagCombinations.Add([new("historic", "tomb")]);
                tagCombinations.Add([new("natural", "cave_entrance")]);
                return tagCombinations;
            case "icon-picnic":
                tagCombinations.Add([new("leisure", "picnic_table")]);
                tagCombinations.Add([new("tourism", "picnic_site")]);
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
                return tagCombinations;
            case "icon-inature":
                tagCombinations.Add([new("ref:IL:inature", "*")]);
                return tagCombinations;
            case "icon-search":
            default:
                // Default icon - could represent any unmatched tags
                return tagCombinations;
        }
    }

    ///<inheritdoc/>
    public IEnumerable<Category> GetCategoriesByGroup(string categoriesGroup)
    {
        string[] categories = categoriesGroup switch
        {
            Categories.POINTS_OF_INTEREST => Categories.Points,
            Categories.ROUTES => Categories.Routes,
            _ => throw new ArgumentException($"categories for the provided categoriesType: {categoriesGroup}"),
        };
        return _categories.Where(c => categories.Contains(c.Name));
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

        if ("waterway".Equals(GetString(attributes, "type")))
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
            }
        }

        if ("peak".Equals(GetString(attributes, "natural")))
        {
            return new IconColorCategory
            {
                Color = "black",
                Icon = "icon-peak",
                Category = Categories.NATURAL
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

        if (GetString(attributes, "ref:IL:inature") != null)
        {
            return new IconColorCategory
            {
                Color = "#116C00",
                Icon = "icon-inature",
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