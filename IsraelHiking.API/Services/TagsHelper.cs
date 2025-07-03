using IsraelHiking.Common;
using IsraelHiking.Common.Configuration;
using Microsoft.Extensions.Options;
using NetTopologySuite.Features;
using System;
using System.Collections.Generic;
using System.Linq;
using IsraelHiking.Common.Extensions;

namespace IsraelHiking.API.Services;

///<inheritdoc/>
public class TagsHelper : ITagsHelper
{
    private readonly ConfigurationData _options;
    private readonly List<Category> _categories;

    /// <summary>
    /// Constructor
    /// </summary>
    /// <param name="optionsProvider"></param>
    public TagsHelper(IOptions<ConfigurationData> optionsProvider)
    {
        _categories = [];
        _options = optionsProvider.Value;

        // ORDER IS IMPORTANT FOR UI //
        _categories.Add(CreateWaterCategory());
        _categories.Add(CreateHistoricCategory());
        _categories.Add(CreateViewpointCategory());
        _categories.Add(CreateCampingCategory());
        _categories.Add(CreateNaturalCategory());
        _categories.Add(CreateOthersCategory());
        _categories.Add(CreateWikipediaCategory());
        _categories.Add(CreateINatureCategory());
        _categories.AddRange(CreateRoutesCategories());
    }

    private Category CreateWaterCategory()
    {
        var waterCategory = new Category
        {
            Color = "blue",
            Icon = "icon-tint",
            Name = Categories.WATER
        };
        var springIcon = new IconColorCategory
        {
            Category = Categories.WATER,
            Color = "blue",
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
            Color = "blue",
            Icon = "icon-waterfall",
            Label = "Waterfall"
        };
        waterCategory.Items.Add(new IconAndTags(waterfallIcon, "waterway", "waterfall"));
        var waterHole = new IconColorCategory
        {
            Category = Categories.WATER,
            Color = "blue",
            Icon = "icon-waterhole",
            Label = "Waterhole"
        };
        waterCategory.Items.Add(new IconAndTags(waterHole, "natural", "waterhole"));
        var waterWell = new IconColorCategory
        {
            Category = Categories.WATER,
            Color = "blue",
            Icon = "icon-water-well",
            Label = "Water Well"
        };
        waterCategory.Items.Add(new IconAndTags(waterWell, "man_made", "water_well"));
        var cistern = new IconColorCategory
        {
            Category = Categories.WATER,
            Color = "blue",
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

    private Category CreateWikipediaCategory()
    {
        var wikipediaCategory = new Category
        {
            Color = "black",
            Icon = "icon-wikipedia-w",
            Name = Categories.WIKIPEDIA
        };
        var wikipediaIcon = new IconColorCategory("icon-wikipedia-w", Categories.WIKIPEDIA);
        wikipediaCategory.Items.Add(new IconAndTags(wikipediaIcon));
        return wikipediaCategory;
    }

    private Category CreateINatureCategory()
    {
        var iNatureCategory = new Category
        {
            Color = "#116C00",
            Icon = "icon-inature",
            Name = Categories.INATURE
        };
        var iNatureIcon = new IconColorCategory("icon-inature", Categories.INATURE);
        iNatureCategory.Items.Add(new IconAndTags(iNatureIcon));
        return iNatureCategory;
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
    public (double SearchFactor, IconColorCategory IconColorCategory) GetInfo(IAttributesTable attributesTable)
    {
        var highSearchFactor = _options.SearchFactor * 2;
        if (attributesTable.GetNames().Any(k => k.Equals("place", StringComparison.OrdinalIgnoreCase)))
        {
            var category = attributesTable.GetNames().Any(k => k.StartsWith(FeatureAttributes.WIKIPEDIA))
                ? Categories.WIKIPEDIA
                : Categories.NONE;
            return (highSearchFactor, new IconColorCategory("icon-home", category));
        }
        var iconTags = _categories.SelectMany(c => c.Items)
            .FirstOrDefault(i => i.Tags
                .Any(t => attributesTable.Has(t.Key, t.Value)));
        if (iconTags != null)
        {
            return (highSearchFactor, iconTags.IconColorCategory);
        }

        if (attributesTable.Has("landuse", "farmyard") ||
            attributesTable.Has("waterway", "stream") ||
            attributesTable.Has("waterway", "river") ||
            attributesTable.Has("waterway", "wadi"))
        {
            return (highSearchFactor, new IconColorCategory());
        }
            
        if (attributesTable.Has("natural", "peak"))
        {
            var category = attributesTable.GetNames().Any(n =>
                n.StartsWith(FeatureAttributes.DESCRIPTION) || n.StartsWith(FeatureAttributes.IMAGE_URL))
                ? Categories.NATURAL
                : Categories.NONE;
            return (highSearchFactor, new IconColorCategory("icon-peak", category));
                
        }

        if (attributesTable.GetNames().Any(k => k.StartsWith(FeatureAttributes.WIKIPEDIA)))
        {
            return (highSearchFactor, new IconColorCategory("icon-wikipedia-w", Categories.WIKIPEDIA));
        }
        if (attributesTable.GetNames().Any(k => k.Contains(FeatureAttributes.MTB_NAME)))
        {
            return (highSearchFactor, new IconColorCategory("icon-bike", Categories.ROUTE_BIKE, "gray", string.Empty));
        }
        if (attributesTable.GetNames().Any(k => k == "highway"))
        {
            var icon = attributesTable["highway"].ToString() == "bus_stop"
                ? new IconColorCategory("icon-bus-stop")
                : new IconColorCategory("icon-map-signs");
            var importantHighway = attributesTable["highway"].ToString() == "path" || attributesTable["highway"].ToString() == "track";
            return (importantHighway ? highSearchFactor : _options.SearchFactor, icon);
        }
        return (_options.SearchFactor, new IconColorCategory());
    }

    ///<inheritdoc/>
    public List<KeyValuePair<string, string>> FindTagsForIcon(string icon)
    {
        var iconAndTags = _categories.SelectMany(c => c.Items).FirstOrDefault(i => i.IconColorCategory.Icon == icon);
        return iconAndTags != null ? iconAndTags.Tags : [];
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
    public List<KeyValuePair<string, string>> GetAllTags()
    {
        return _categories.SelectMany(v => v.Items).SelectMany(i => i.Tags).ToList();
    }
}