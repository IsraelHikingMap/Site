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
            var ruinsIcon = new IconColorCategory
            {
                Category = Categories.HISTORIC,
                Color = "brown",
                Icon = "icon-ruins"
            };
            _iconsToTags[ruinsIcon.Icon] = new IconTags(ruinsIcon, new List<KeyValuePair<string, string>>
            {
                new KeyValuePair<string, string>("historic", "ruins"),
                new KeyValuePair<string, string>("historic", "archaeological_site"),
                new KeyValuePair<string, string>("historic", "memorial"),
                new KeyValuePair<string, string>("historic", "monument"),
                new KeyValuePair<string, string>("man_made", "water_well")
            });

            var springIcon = new IconColorCategory
            {
                Category = Categories.WATER,
                Color = "blue",
                Icon = "icon-tint"
            };
            _iconsToTags[springIcon.Icon] = new IconTags(springIcon, new List<KeyValuePair<string, string>>
            {
                new KeyValuePair<string, string>("natural", "spring"),
                new KeyValuePair<string, string>("natural", "waterhole"),
                new KeyValuePair<string, string>("water", "pond"),
                new KeyValuePair<string, string>("man_made", "cistern"),
                new KeyValuePair<string, string>("waterway", "waterfall"),
            });
            var natureReserveIcon = new IconColorCategory
            {
                Icon = "icon-nature-reserve",
                Color = "green",
                Category = Categories.OTHER
            };
            _iconsToTags[natureReserveIcon.Icon] = new IconTags(natureReserveIcon,
                new List<KeyValuePair<string, string>>
                {
                    new KeyValuePair<string, string>("boundary", "national_park"),
                    new KeyValuePair<string, string>("boundary", "protected_area"),
                    new KeyValuePair<string, string>("leisure", "nature_reserve"),
                });
            var iconPicnic = new IconColorCategory
            {
                Icon = "icon-picnic",
                Color = "brown",
                Category = Categories.CAMPING
            };
            _iconsToTags[iconPicnic.Icon] = new IconTags(iconPicnic, new List<KeyValuePair<string, string>>
            {
                new KeyValuePair<string, string>("tourism", "picnic_site"),
                new KeyValuePair<string, string>("leisure", "picnic"),
                new KeyValuePair<string, string>("leisure", "picnic_table"),

            });
            var campsiteIcon = new IconColorCategory("icon-campsite", Categories.CAMPING);
            _iconsToTags[campsiteIcon.Icon] = new IconTags(campsiteIcon, CreateOne("tourism", "camp_site"));

            var viewpointIcon = new IconColorCategory("icon-viewpoint", Categories.VIEWPOINT);
            _iconsToTags[viewpointIcon.Icon] = new IconTags(viewpointIcon, CreateOne("tourism", "viewpoint"));

            var attractionIcon = new IconColorCategory("icon-star", Categories.OTHER, "orange");
            _iconsToTags[attractionIcon.Icon] = new IconTags(attractionIcon, CreateOne("tourism", "attraction"));
            var peakIcon = new IconColorCategory("icon-peak");
            _iconsToTags[peakIcon.Icon] = new IconTags(peakIcon, CreateOne("natural", "peak"));

            var bicycleIcon = new IconColorCategory("icon-bike", Categories.ROUTE_BIKE);
            _iconsToTags[bicycleIcon.Icon] = new IconTags(bicycleIcon, new List<KeyValuePair<string, string>>
            {
                new KeyValuePair<string, string>("route", "bicycle"),
                new KeyValuePair<string, string>("route", "mtb")
            });
            var hikingIcon = new IconColorCategory("icon-hike", Categories.ROUTE_HIKE);
            _iconsToTags[hikingIcon.Icon] = new IconTags(hikingIcon, CreateOne("route", "hiking"));

            _iconsToTags[string.Empty] = new IconTags(new IconColorCategory(), new List<KeyValuePair<string, string>>
            {
                new KeyValuePair<string, string>("landuse", "farmyard"),
                new KeyValuePair<string, string>("waterway", "stream"),
                new KeyValuePair<string, string>("waterway", "river"),
                new KeyValuePair<string, string>("waterway", "wadi")
            });
            var treeIcon = new IconColorCategory("icon-tree", Categories.NATURAL, "green");
            _iconsToTags[treeIcon.Icon] = new IconTags(treeIcon, CreateOne("natural", "tree"));

            var caveIcon = new IconColorCategory("icon-cave", Categories.NATURAL);
            _iconsToTags[caveIcon.Icon] = new IconTags(caveIcon, CreateOne("natural", "cave_entrance"));

            var flowersIcon = new IconColorCategory("icon-flowers", Categories.NATURAL, "purple");
            _iconsToTags[flowersIcon.Icon] = new IconTags(flowersIcon, CreateOne("natural", "flowers"));
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
            if (iconTags == null)
            {
                return (_options.SearchFactor, new IconColorCategory());
            }
            if (attributesTable.GetNames().Any(k => k.Equals("highway", StringComparison.OrdinalIgnoreCase)))
            {
                var icon = attributesTable["highway"].ToString() == "bus_stop"
                    ? new IconColorCategory("icon-bus-stop")
                    : new IconColorCategory("icon-map-signs");
                return (_options.SearchFactor, icon);
            }
            return (1, iconTags.IconColorCategory);
        }

        ///<inheritdoc/>
        public List<KeyValuePair<string, string>> FindTagsForIcon(string icon)
        {
            return _iconsToTags.ContainsKey(icon) ? _iconsToTags[icon].Tags : new List<KeyValuePair<string, string>>();
        }
    }
}
;