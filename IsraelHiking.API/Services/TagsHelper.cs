using System;
using System.Collections.Generic;
using System.Linq;
using IsraelHiking.Common;
using NetTopologySuite.Features;
using Microsoft.Extensions.Options;

namespace IsraelHiking.API.Services
{
    internal class IconTags
    {
        public IconColorCategory IconColorCategory { get; }
        public List<KeyValuePair<string, string>> Tags { get; }

        public IconTags(IconColorCategory iconColorCategory, List<KeyValuePair<string, string>> tags)
        {
            IconColorCategory = iconColorCategory;
            Tags = tags;
        }
    }

    ///<inheritdoc/>
    public class TagsHelper : ITagsHelper
    {
        private readonly ConfigurationData _options;
        private readonly Dictionary<string, IconTags> _iconsToTags;

        /// <summary>
        /// Constructor
        /// </summary>
        /// <param name="optionsProvider"></param>
        public TagsHelper(IOptions<ConfigurationData> optionsProvider)
        {
            _iconsToTags = new Dictionary<string, IconTags>();
            _options = optionsProvider.Value;
            // ORDER IS IMPORTNAT FOR UI, BOTH CATEGORIES AND FIRST ICON //

            // Water //
            var springIcon = new IconColorCategory
            {
                Category = Categories.WATER,
                Color = "blue",
                Icon = "icon-tint",
                Label = "Spring, Pond"
            };
            _iconsToTags[springIcon.Icon] = new IconTags(springIcon, new List<KeyValuePair<string, string>>
            {
                new KeyValuePair<string, string>("natural", "spring"),
                new KeyValuePair<string, string>("water", "pond")
            });
            var waterfallIcon = new IconColorCategory
            {
                Category = Categories.WATER,
                Color = "blue",
                Icon = "icon-waterfall",
                Label = "Waterfall"
            };
            _iconsToTags[waterfallIcon.Icon] = new IconTags(waterfallIcon, CreateOne("waterway", "waterfall"));
            var waterHole = new IconColorCategory
            {
                Category = Categories.WATER,
                Color = "blue",
                Icon = "icon-waterhole",
                Label = "Waterhole"
            };
            _iconsToTags[waterHole.Icon] = new IconTags(waterHole, CreateOne("natural", "waterhole"));
            var waterWell = new IconColorCategory
            {
                Category = Categories.WATER,
                Color = "blue",
                Icon = "icon-water-well",
                Label = "Water Well"
            };
            _iconsToTags[waterWell.Icon] = new IconTags(waterWell, CreateOne("man_made", "water_well"));
            var cistern = new IconColorCategory
            {
                Category = Categories.WATER,
                Color = "blue",
                Icon = "icon-cistern",
                Label = "Cistern"
            };
            _iconsToTags[cistern.Icon] = new IconTags(cistern, CreateOne("man_made", "cistern"));

            // Historic //
            var ruinsIcon = new IconColorCategory
            {
                Category = Categories.HISTORIC,
                Color = "brown",
                Icon = "icon-ruins",
                Label = "Ruins"
            };
            _iconsToTags[ruinsIcon.Icon] = new IconTags(ruinsIcon, CreateOne("historic", "ruins"));
            var archaeologicalSiteIcon = new IconColorCategory
            {
                Category = Categories.HISTORIC,
                Color = "brown",
                Icon = "icon-archaeological",
                Label = "Archeological Site"
            };
            _iconsToTags[archaeologicalSiteIcon.Icon] = new IconTags(archaeologicalSiteIcon, CreateOne("historic", "archaeological_site"));
            var memorialIcon = new IconColorCategory
            {
                Category = Categories.HISTORIC,
                Color = "brown",
                Icon = "icon-memorial",
                Label = "Memorial"
            };
            _iconsToTags[memorialIcon.Icon] = new IconTags(memorialIcon, new List<KeyValuePair<string, string>>
            {
                new KeyValuePair<string, string>("historic", "memorial"),
                new KeyValuePair<string, string>("historic", "monument"),
            });
            // View Point //
            var viewpointIcon = new IconColorCategory("icon-viewpoint", Categories.VIEWPOINT, "black", "Viewpoint");
            _iconsToTags[viewpointIcon.Icon] = new IconTags(viewpointIcon, CreateOne("tourism", "viewpoint"));

            // Camping //
            var iconPicnic = new IconColorCategory
            {
                Icon = "icon-picnic",
                Color = "brown",
                Category = Categories.CAMPING,
                Label = "Picnic Area"
            };
            _iconsToTags[iconPicnic.Icon] = new IconTags(iconPicnic, new List<KeyValuePair<string, string>>
            {
                new KeyValuePair<string, string>("tourism", "picnic_site"),
                new KeyValuePair<string, string>("leisure", "picnic"),
                new KeyValuePair<string, string>("leisure", "picnic_table"),
            });
            var campsiteIcon = new IconColorCategory("icon-campsite", Categories.CAMPING, "black", "Campsite");
            _iconsToTags[campsiteIcon.Icon] = new IconTags(campsiteIcon, CreateOne("tourism", "camp_site"));

            // Natual //
            var caveIcon = new IconColorCategory("icon-cave", Categories.NATURAL, "black", "Cave");
            _iconsToTags[caveIcon.Icon] = new IconTags(caveIcon, CreateOne("natural", "cave_entrance"));

            var treeIcon = new IconColorCategory("icon-tree", Categories.NATURAL, "green", "Tree");
            _iconsToTags[treeIcon.Icon] = new IconTags(treeIcon, CreateOne("natural", "tree"));

            var flowersIcon = new IconColorCategory("icon-flowers", Categories.NATURAL, "purple", "Flowers");
            _iconsToTags[flowersIcon.Icon] = new IconTags(flowersIcon, CreateOne("natural", "flowers"));

            // Other //
            var attractionIcon = new IconColorCategory("icon-star", Categories.OTHER, "orange", "Attraction");
            _iconsToTags[attractionIcon.Icon] = new IconTags(attractionIcon, CreateOne("tourism", "attraction"));
            var natureReserveIcon = new IconColorCategory
            {
                Icon = "icon-nature-reserve",
                Color = "green",
                Category = Categories.OTHER,
                Label = "Nature Reserve, National Park"
            };
            _iconsToTags[natureReserveIcon.Icon] = new IconTags(natureReserveIcon,
                new List<KeyValuePair<string, string>>
                {
                    new KeyValuePair<string, string>("leisure", "nature_reserve"),
                    new KeyValuePair<string, string>("boundary", "national_park"),
                    new KeyValuePair<string, string>("boundary", "protected_area")
                });

            var hikingIcon = new IconColorCategory("icon-hike", Categories.ROUTE_HIKE);
            _iconsToTags[hikingIcon.Icon] = new IconTags(hikingIcon, CreateOne("route", "hiking"));

            var bicycleIcon = new IconColorCategory("icon-bike", Categories.ROUTE_BIKE);
            _iconsToTags[bicycleIcon.Icon] = new IconTags(bicycleIcon, new List<KeyValuePair<string, string>>
            {
                new KeyValuePair<string, string>("route", "bicycle"),
                new KeyValuePair<string, string>("route", "mtb")
            });

            var fourWheelDriveIcon = new IconColorCategory("icon-four-by-four", Categories.ROUTE_4X4);
            _iconsToTags[fourWheelDriveIcon.Icon] = new IconTags(fourWheelDriveIcon, new List<KeyValuePair<string, string>>());

            // For search but not as POI
            var peakIcon = new IconColorCategory("icon-peak");
            _iconsToTags[peakIcon.Icon] = new IconTags(peakIcon, CreateOne("natural", "peak"));

            _iconsToTags[string.Empty] = new IconTags(new IconColorCategory(), new List<KeyValuePair<string, string>>
            {
                new KeyValuePair<string, string>("landuse", "farmyard"),
                new KeyValuePair<string, string>("waterway", "stream"),
                new KeyValuePair<string, string>("waterway", "river"),
                new KeyValuePair<string, string>("waterway", "wadi")
            });
        }

        private List<KeyValuePair<string, string>> CreateOne(string key, string value)
        {
            return new List<KeyValuePair<string, string>>
            {
                new KeyValuePair<string, string>(key, value)
            };
        }

        ///<inheritdoc/>
        public (double SearchFactor, IconColorCategory IconColorCategory) GetInfo(IAttributesTable attributesTable)
        {
            if (attributesTable.GetNames().Any(k => k.Equals("place", StringComparison.OrdinalIgnoreCase)))
            {
                return (1, new IconColorCategory("icon-home"));
            }
            var iconTags = _iconsToTags.Values.FirstOrDefault(i =>
                i.Tags.FirstOrDefault(
                        t => attributesTable.Exists(t.Key) && attributesTable[t.Key].ToString() == t.Value)
                    .Equals(default(KeyValuePair<string, string>)) == false);
            if (iconTags != null)
            {
                return (1, iconTags.IconColorCategory);
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
            return _iconsToTags.ContainsKey(icon) ? _iconsToTags[icon].Tags : new List<KeyValuePair<string, string>>();
        }

        ///<inheritdoc/>
        public Dictionary<string, IEnumerable<IconColorCategory>> GetIconsPerCategoryByType(string categoriesType)
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
            return _iconsToTags.Values.GroupBy(i => i.IconColorCategory.Category)
                .Where(g => categories.Contains(g.Key))
                .ToDictionary(g => g.Key, g => g.Select(i => i.IconColorCategory));
        }

        ///<inheritdoc/>
        public List<KeyValuePair<string, string>> GetAllTags()
        {
            return _iconsToTags.Values.SelectMany(v => v.Tags).ToList();
        }
    }
}
;