using System;
using System.Collections.Generic;
using System.Linq;
using IsraelHiking.Common;
using NetTopologySuite.Features;
using Microsoft.Extensions.Options;

namespace IsraelHiking.API.Services
{
    ///<inheritdoc/>
    public class TagsHelper : ITagsHelper
    {
        private readonly ConfigurationData _options;
        //private readonly Dictionary<string, IconTags> _iconsToTags;
        private readonly List<Category> _categories;

        /// <summary>
        /// Constructor
        /// </summary>
        /// <param name="optionsProvider"></param>
        public TagsHelper(IOptions<ConfigurationData> optionsProvider)
        {
            _categories = new List<Category>();
            _options = optionsProvider.Value;

            // ORDER IS IMPORTNAT FOR UI //
            _categories.Add(CreateWaterCategory());
            _categories.Add(CreateHistoricCategory());
            _categories.Add(CreateViewpointCategory());
            _categories.Add(CreateCampingCategory());
            _categories.Add(CreateNaturalCategory());
            _categories.Add(CreateOthersCategory());
            _categories.Add(CreateWikipediaCategory());
            _categories.AddRange(CreateRoutesCategories());

            // For search but not as POI
            _categories.Add(CreateNoneCategory());
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
            waterCategory.Items.Add(new IconAndTags(springIcon, new List<KeyValuePair<string, string>>
            {
                new KeyValuePair<string, string>("natural", "spring"),
                new KeyValuePair<string, string>("water", "pond")
            }));
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
                Color = "brown",
                Icon = "icon-ruins",
                Name = Categories.HISTORIC
            };
            var ruinsIcon = new IconColorCategory
            {
                Category = Categories.HISTORIC,
                Color = "brown",
                Icon = "icon-ruins",
                Label = "Ruins"
            };
            historicCategory.Items.Add(new IconAndTags(ruinsIcon, "historic", "ruins"));
            var archaeologicalSiteIcon = new IconColorCategory
            {
                Category = Categories.HISTORIC,
                Color = "brown",
                Icon = "icon-archaeological",
                Label = "Archeological Site"
            };
            historicCategory.Items.Add(new IconAndTags(archaeologicalSiteIcon, "historic", "archaeological_site"));
            var memorialIcon = new IconColorCategory
            {
                Category = Categories.HISTORIC,
                Color = "brown",
                Icon = "icon-memorial",
                Label = "Memorial"
            };
            historicCategory.Items.Add(new IconAndTags(memorialIcon, new List<KeyValuePair<string, string>>
            {
                new KeyValuePair<string, string>("historic", "memorial"),
                new KeyValuePair<string, string>("historic", "monument"),
            }));
            return historicCategory;
        }

        private Category CreateViewpointCategory()
        {
            var viewPointCategory = new Category
            {
                Icon = "icon-viewpoint",
                Color = "black",
                Name = Categories.VIEWPOINT
            };
            var viewpointIcon = new IconColorCategory("icon-viewpoint", Categories.VIEWPOINT, "black", "Viewpoint");
            viewPointCategory.Items.Add(new IconAndTags(viewpointIcon, "tourism", "viewpoint"));

            return viewPointCategory;
        }

        private Category CreateCampingCategory()
        {
            var campingCategory = new Category
            {
                Color = "brown",
                Icon = "icon-picnic",
                Name = Categories.CAMPING
            };
            var iconPicnic = new IconColorCategory
            {
                Icon = "icon-picnic",
                Color = "brown",
                Category = Categories.CAMPING,
                Label = "Picnic Area"
            };
            campingCategory.Items.Add(new IconAndTags(iconPicnic, new List<KeyValuePair<string, string>>
            {
                new KeyValuePair<string, string>("tourism", "picnic_site"),
                new KeyValuePair<string, string>("leisure", "picnic"),
                new KeyValuePair<string, string>("leisure", "picnic_table"),
            }));
            var campsiteIcon = new IconColorCategory("icon-campsite", Categories.CAMPING, "black", "Campsite");
            campingCategory.Items.Add(new IconAndTags(campsiteIcon, "tourism", "camp_site"));
            return campingCategory;
        }

        private Category CreateNaturalCategory()
        {
            var naturalCategory = new Category
            {
                Color = "green",
                Name = Categories.NATURAL,
                Icon = "icon-tree"
            };
            var caveIcon = new IconColorCategory("icon-cave", Categories.NATURAL, "black", "Cave");
            naturalCategory.Items.Add(new IconAndTags(caveIcon, "natural", "cave_entrance"));

            var treeIcon = new IconColorCategory("icon-tree", Categories.NATURAL, "green", "Tree");
            naturalCategory.Items.Add(new IconAndTags(treeIcon, "natural", "tree"));

            var flowersIcon = new IconColorCategory("icon-flowers", Categories.NATURAL, "purple", "Flowers");
            naturalCategory.Items.Add(new IconAndTags(flowersIcon, "natural", "flowers"));

            return naturalCategory;
        }

        private Category CreateOthersCategory()
        {
            var otherCategory = new Category
            {
                Color = "orange",
                Icon = "icon-star",
                Name = Categories.OTHER
            };

            var attractionIcon = new IconColorCategory("icon-star", Categories.OTHER, "orange", "Attraction");
            otherCategory.Items.Add(new IconAndTags(attractionIcon, "tourism", "attraction"));
            var natureReserveIcon = new IconColorCategory
            {
                Icon = "icon-nature-reserve",
                Color = "green",
                Category = Categories.OTHER,
                Label = "Nature Reserve, National Park"
            };
            otherCategory.Items.Add(new IconAndTags(natureReserveIcon,
                new List<KeyValuePair<string, string>>
                {
                    new KeyValuePair<string, string>("leisure", "nature_reserve"),
                    new KeyValuePair<string, string>("boundary", "national_park"),
                    new KeyValuePair<string, string>("boundary", "protected_area")
                }));

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

        private Category CreateNoneCategory()
        {
            var noneCategory = new Category
            {
                Icon = "",
                Name = Categories.NONE,
                Color = ""
            };
            var peakIcon = new IconColorCategory("icon-peak");
            noneCategory.Items.Add(new IconAndTags(peakIcon, "natural", "peak"));

            noneCategory.Items.Add(new IconAndTags(new IconColorCategory(), new List<KeyValuePair<string, string>>
            {
                new KeyValuePair<string, string>("landuse", "farmyard"),
                new KeyValuePair<string, string>("waterway", "stream"),
                new KeyValuePair<string, string>("waterway", "river"),
                new KeyValuePair<string, string>("waterway", "wadi")
            }));
            return noneCategory;
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
            hikeCategory.Items.Add(new IconAndTags(hikeIcon, new List<KeyValuePair<string, string>>
            {
                new KeyValuePair<string, string>("route", "hiking")
            }));
            var bikeCategory = new Category
            {
                Color = "black",
                Icon = "icon-bike",
                Name = Categories.ROUTE_BIKE
            };
            var bikeIcon = new IconColorCategory("icon-bike", Categories.ROUTE_BIKE);
            bikeCategory.Items.Add(new IconAndTags(bikeIcon, new List<KeyValuePair<string, string>>
            {
                new KeyValuePair<string, string>("route", "bicycle"),
                new KeyValuePair<string, string>("route", "mtb")
            }));
            var fourWheelDrivecategory = new Category
            {
                Color = "black",
                Icon = "icon-four-by-four",
                Name = Categories.ROUTE_4X4
            };
            return new[]
            {
                hikeCategory,
                bikeCategory,
                fourWheelDrivecategory
            };
        }

        ///<inheritdoc/>
        public (double SearchFactor, IconColorCategory IconColorCategory) GetInfo(IAttributesTable attributesTable)
        {
            if (attributesTable.GetNames().Any(k => k.Equals("place", StringComparison.OrdinalIgnoreCase)))
            {
                return (1, new IconColorCategory("icon-home"));
            }
            var iconTags = _categories.SelectMany(c => c.Items)
                .FirstOrDefault(i => i.Tags
                    .Any(t => attributesTable.Exists(t.Key) && attributesTable[t.Key].ToString() == t.Value));
            if (iconTags != null)
            {
                return (1, iconTags.IconColorCategory);
            }
            if (attributesTable.GetNames().Any(k => k.StartsWith(FeatureAttributes.WIKIPEDIA)))
            {
                return (1, new IconColorCategory("icon-wikipedia-w", Categories.WIKIPEDIA));
            }
            if (attributesTable.GetNames().Any(k => k.Equals("highway", StringComparison.OrdinalIgnoreCase)))
            {
                var icon = attributesTable["highway"].ToString() == "bus_stop"
                    ? new IconColorCategory("icon-bus-stop")
                    : new IconColorCategory("icon-map-signs");
                return (_options.SearchFactor, icon);
            }
            return (_options.SearchFactor, new IconColorCategory());
        }

        ///<inheritdoc/>
        public List<KeyValuePair<string, string>> FindTagsForIcon(string icon)
        {
            var iconAndTags = _categories.SelectMany(c => c.Items).FirstOrDefault(i => i.IconColorCategory.Icon == icon);
            return iconAndTags != null ? iconAndTags.Tags : new List<KeyValuePair<string, string>>();
        }

        ///<inheritdoc/>
        public IEnumerable<Category> GetCategoriesByType(string categoriesType)
        {
            string[] categories;
            switch (categoriesType)
            {
                case Categories.POINTS_OF_INTEREST:
                    categories = Categories.Points;
                    break;
                case Categories.ROUTES:
                    categories = Categories.Routes;
                    break;
                default:
                    throw new ArgumentException($"categories for the provided categoriesType: {categoriesType}");
            }

            return _categories.Where(c => categories.Contains(c.Name));
        }

        ///<inheritdoc/>
        public List<KeyValuePair<string, string>> GetAllTags()
        {
            return _categories.SelectMany(v => v.Items).SelectMany(i => i.Tags).ToList();
        }
    }
}
;