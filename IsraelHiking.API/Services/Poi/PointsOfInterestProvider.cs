using IsraelHiking.API.Converters;
using IsraelHiking.API.Executors;
using IsraelHiking.API.Services.Osm;
using IsraelHiking.Common;
using IsraelHiking.Common.Extensions;
using IsraelHiking.DataAccessInterfaces;
using IsraelHiking.DataAccessInterfaces.Repositories;
using Microsoft.Extensions.Logging;
using NetTopologySuite.Features;
using NetTopologySuite.Geometries;
using OsmSharp;
using OsmSharp.Complete;
using OsmSharp.IO.API;
using OsmSharp.Tags;
using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Security.Cryptography;
using System.Text.RegularExpressions;
using System.Threading.Tasks;

namespace IsraelHiking.API.Services.Poi;

/// <summary>
/// Points of interest provider
/// </summary>
public class PointsOfInterestProvider : IPointsOfInterestProvider
{
    /// <summary>
    /// This icon is the default icon when no icon was used
    /// </summary>
    public const string SEARCH_ICON = "icon-search";

    private readonly IOsmGeoJsonPreprocessorExecutor _osmGeoJsonPreprocessorExecutor;
    private readonly ITagsHelper _tagsHelper;
    private readonly IClientsFactory _clientsFactory;
    private readonly IPointsOfInterestRepository _pointsOfInterestRepository;
    private readonly IExternalSourcesRepository _externalSourcesRepository;
    private readonly IWikimediaCommonGateway _wikimediaCommonGateway;
    private readonly IBase64ImageStringToFileConverter _base64ImageConverter;
    private readonly IImagesUrlsStorageExecutor _imageUrlStoreExecutor;
    private readonly ILogger _logger;

    /// <summary>
    /// Class constructor
    /// </summary>
    /// <param name="pointsOfInterestRepository"></param>
    /// <param name="externalSourcesRepository"></param>
    /// <param name="osmGeoJsonPreprocessorExecutor"></param>
    /// <param name="wikimediaCommonGateway"></param>
    /// <param name="base64ImageConverter"></param>
    /// <param name="imageUrlStoreExecutor"></param>
    /// <param name="tagsHelper"></param>
    /// <param name="clientsFactory"></param>
    /// <param name="logger"></param>
    public PointsOfInterestProvider(IPointsOfInterestRepository pointsOfInterestRepository,
        IExternalSourcesRepository externalSourcesRepository,
        IOsmGeoJsonPreprocessorExecutor osmGeoJsonPreprocessorExecutor,
        IWikimediaCommonGateway wikimediaCommonGateway,
        IBase64ImageStringToFileConverter base64ImageConverter,
        IImagesUrlsStorageExecutor imageUrlStoreExecutor,
        ITagsHelper tagsHelper,
        IClientsFactory clientsFactory,
        ILogger logger)
    {
        _osmGeoJsonPreprocessorExecutor = osmGeoJsonPreprocessorExecutor;
        _tagsHelper = tagsHelper;
        _clientsFactory = clientsFactory;
        _pointsOfInterestRepository = pointsOfInterestRepository;
        _externalSourcesRepository = externalSourcesRepository;
        _wikimediaCommonGateway = wikimediaCommonGateway;
        _base64ImageConverter = base64ImageConverter;
        _imageUrlStoreExecutor = imageUrlStoreExecutor;
        _logger = logger;
    }

    /// <summary>
    /// Updates the location in case the OSM element is of type node and the location change is not too little
    /// </summary>
    /// <param name="completeOsmGeo">The element to update</param>
    /// <param name="location">The new location</param>
    /// <returns>True if the location was updated, false otherwise</returns>
    private bool UpdateLocationIfNeeded(ICompleteOsmGeo completeOsmGeo, LatLng location)
    {
        var node = completeOsmGeo as Node;
        if (node == null)
        {
            return false;
        }
        if (new Coordinate(node.Longitude.Value, node.Latitude.Value).Equals2D(location.ToCoordinate(), 0.00001))
        {
            return false;
        }
        node.Latitude = location.Lat;
        node.Longitude = location.Lng;
        return true;
    }

    private IFeature ConvertOsmToFeature(ICompleteOsmGeo osm)
    {
        var features = _osmGeoJsonPreprocessorExecutor.Preprocess([osm]);
        return features.Any() ? features.First() : null;
    }

    private void SetTagByLanguage(TagsCollectionBase tags, string key, string value, string language)
    {
        var keyWithLanguage = key + ":" + language;
        var previousValue = string.Empty;
        if (tags.ContainsKey(keyWithLanguage))
        {
            previousValue = tags[keyWithLanguage];
            tags[keyWithLanguage] = value;
        }
        else
        {
            tags.Add(new Tag(keyWithLanguage, value));
        }
        if (tags.ContainsKey(key) && tags[key] == previousValue)
        {
            tags[key] = value;
        }
        else if (tags.ContainsKey(key) == false)
        {
            tags.Add(new Tag(key, value));
        }
    }

    private void AddTagsByIcon(TagsCollectionBase tags, string icon)
    {
        var tagsList = _tagsHelper.FindTagsForIcon(icon);
        if (tagsList.Any())
        {
            tags.AddOrReplace(tagsList.First().Key, tagsList.First().Value);
        }
    }

    private void RemoveTagsByIcon(TagsCollectionBase tags, string icon)
    {
        var tagsList = _tagsHelper.FindTagsForIcon(icon);
        if (tagsList.Any() == false)
        {
            return;
        }
        foreach (var keyValuePair in tagsList)
        {
            var tag = tags.FirstOrDefault(t => t.Key == keyValuePair.Key && t.Value == keyValuePair.Value);
            if (tag.Equals(default(Tag)) == false)
            {
                tags.RemoveKeyValue(tag);
                // removing only one matching tag
                return;
            }
        }
    }

    private void RemoveEmptyTagsAndWhiteSpaces(TagsCollectionBase tags)
    {
        for (int i = tags.Count - 1; i >= 0; i--)
        {
            var currentTag = tags.ElementAt(i);
            if (string.IsNullOrWhiteSpace(currentTag.Value))
            {
                tags.RemoveKeyValue(currentTag);
            }
            else
            {
                var valueWithOutExtraSpaces = Regex.Replace(currentTag.Value, @"\s+", " ", RegexOptions.Multiline).Trim();
                currentTag.Value = valueWithOutExtraSpaces;
                tags.AddOrReplace(currentTag);
            }
        }
    }

    private void SetWebsiteAndWikiTags(TagsCollectionBase tags, List<string> urls)
    {
        var wikipediaRegexp = new Regex(@"((https?://)|^)([a-z]+)(\.m)?\.wikipedia.org/wiki/(.*)");
        var wikidataRegexp = new Regex(@"((https?://)|^)([a-z]+)(\.m)?\.wikidata.org/wiki/(.*)");

        var nonWikipediaUrls = new List<string>();
        foreach (var url in urls)
        {
            var matchWikipedia = wikipediaRegexp.Match(url ?? string.Empty);
            if (matchWikipedia.Success)
            {
                var language = matchWikipedia.Groups[3].Value;
                var pageTitle = Uri.UnescapeDataString(matchWikipedia.Groups[5].Value.Replace("_", " "));
                var key = FeatureAttributes.WIKIPEDIA + ":" + language;
                tags.AddOrReplace(key, pageTitle);
                key = FeatureAttributes.WIKIPEDIA;
                pageTitle = language + ":" + pageTitle;
                if (tags.ContainsKey(key) == false)
                {
                    tags.Add(key, pageTitle);
                }
                continue;
            }
            var matchWikidata = wikidataRegexp.Match(url ?? string.Empty);
            if (matchWikidata.Success)
            {
                tags.AddOrReplace(FeatureAttributes.WIKIDATA, matchWikidata.Groups[5].Value);
                continue;
            }
            nonWikipediaUrls.Add(url);
        }
        SetMultipleValuesForTag(tags, FeatureAttributes.WEBSITE, nonWikipediaUrls.ToArray());
    }

    private void SetMultipleValuesForTag(TagsCollectionBase tags, string tagKey, string[] values)
    {
        foreach (var tag in tags.Where(t => t.Key.StartsWith(tagKey)))
        {
            tags.RemoveKey(tag.Key);
        }
        for (var index = 0; index < values.Length; index++)
        {
            var value = values[index];
            var tagName = index == 0 ? tagKey : tagKey + index;
            tags.AddOrReplace(tagName, value);
        }
    }

    /// <inheritdoc/>
    public async Task<IFeature> GetClosestPoint(Coordinate location, string source, string language)
    {
        return await _pointsOfInterestRepository.GetClosestPoint(location, source, language);
    }

    /// <inheritdoc/>
    public async Task<IFeature> GetFeatureById(string source, string id)
    {
        IFeature feature;
        if (source == Sources.OSM)
        {
            var client = _clientsFactory.CreateNonAuthClient();
            var osmElement = await client.GetCompleteElement(GeoJsonExtensions.GetOsmId(id), GeoJsonExtensions.GetOsmType(id));
            feature = ConvertOsmToFeature(osmElement);    
        }
        else
        {
            feature = await _externalSourcesRepository.GetExternalPoiById(id, source);
        }

        if (feature == null)
        {
            return null;
        }
        if (string.IsNullOrWhiteSpace(feature.Attributes[FeatureAttributes.POI_ICON]?.ToString()))
        {
            feature.Attributes.AddOrUpdate(FeatureAttributes.POI_ICON, SEARCH_ICON);
        }
        return feature;
    }
        

    /// <inheritdoc/>
    public async Task<IFeature> AddFeature(IFeature feature, IAuthClient osmGateway, string language)
    {
        var icon = feature.Attributes[FeatureAttributes.POI_ICON].ToString();
        var location = feature.GetLocation();
        var idString = feature.GetId();
        _logger.LogInformation($"Uploaded a POI of type {icon} with id: {idString}, at {location.Y}, {location.X}");
        var imagesList = await UploadImages(feature, language, osmGateway);
        var node = new Node
        {
            Latitude = location.Y,
            Longitude = location.X,
            Tags = new TagsCollection()
        };
        SetWebsiteAndWikiTags(node.Tags, feature.Attributes.GetNames()
            .Where(n => n.StartsWith(FeatureAttributes.WEBSITE))
            .Select(p => feature.Attributes[p].ToString())
            .ToList());
        SetMultipleValuesForTag(node.Tags, FeatureAttributes.IMAGE_URL, imagesList);
        SetTagByLanguage(node.Tags, FeatureAttributes.NAME, feature.GetTitle(language), language);
        SetTagByLanguage(node.Tags, FeatureAttributes.DESCRIPTION, feature.GetDescription(language), language);
        AddTagsByIcon(node.Tags, feature.Attributes[FeatureAttributes.POI_ICON].ToString());
        RemoveEmptyTagsAndWhiteSpaces(node.Tags);
        await osmGateway.UploadToOsmWithRetries(
            $"Added {feature.GetTitle(language)} using {Branding.BASE_URL}",
            async changeSetId =>
            {
                node.Id = await osmGateway.CreateElement(changeSetId, node);
            },
            _logger);

        return ConvertOsmToFeature(node);
    }

    /// <inheritdoc/>
    public async Task<IFeature> UpdateFeature(IFeature partialFeature, IAuthClient osmGateway, string language)
    {
        ICompleteOsmGeo completeOsmGeo = await osmGateway.GetCompleteElement(partialFeature.GetOsmId(), partialFeature.GetOsmType());
        var oldIcon = _tagsHelper.GetInfo(new AttributesTable(completeOsmGeo.Tags.ToDictionary(t => t.Key, t => t.Value as object))).IconColorCategory.Icon;
        var oldTags = completeOsmGeo.Tags.ToArray();
        var locationWasUpdated = false;
        partialFeature.SetTitles();
        if (partialFeature.Attributes.GetNames().Any(n => n.StartsWith(FeatureAttributes.NAME)))
        {
            SetTagByLanguage(completeOsmGeo.Tags, FeatureAttributes.NAME, partialFeature.GetTitle(language), language);
        }
        if (partialFeature.Attributes.GetNames().Any(n => n.StartsWith(FeatureAttributes.DESCRIPTION)))
        {
            SetTagByLanguage(completeOsmGeo.Tags, FeatureAttributes.DESCRIPTION, partialFeature.GetDescription(language), language);
        }
        if (partialFeature.Attributes.Exists(FeatureAttributes.POI_ICON))
        {
            var icon = partialFeature.Attributes[FeatureAttributes.POI_ICON].ToString();
            if (icon != oldIcon && icon != SEARCH_ICON)
            {
                RemoveTagsByIcon(completeOsmGeo.Tags, oldIcon);
                AddTagsByIcon(completeOsmGeo.Tags, icon);
            }
        }
        if (partialFeature.Attributes.Exists(FeatureAttributes.POI_GEOLOCATION))
        {
            var coordinate = partialFeature.GetLocation();
            var location = new LatLng(coordinate.Y, coordinate.X);
            locationWasUpdated = UpdateLocationIfNeeded(completeOsmGeo, location);
        }

        await UpdateWebsitesAndImages(partialFeature, completeOsmGeo, osmGateway, language);

        RemoveEmptyTagsAndWhiteSpaces(completeOsmGeo.Tags);
        if (oldTags.SequenceEqual(completeOsmGeo.Tags.ToArray()) &&
            !locationWasUpdated)
        {
            return null;
        }

        var feature = ConvertOsmToFeature(completeOsmGeo);
        await osmGateway.UploadToOsmWithRetries(
            $"Updated {feature?.GetTitle(language)} using {Branding.BASE_URL}",
            async changeSetId =>
            {
                await osmGateway.UpdateElement(changeSetId, completeOsmGeo);
            },
            _logger
        );

        return feature;
    }

    /// <summary>
    /// This function updates the lists of items in the OSM entity, i.e. websites and images.
    /// In case there are "holes" the function reorders the list to remove holes such as image=..., image2=...
    /// </summary>
    /// <param name="partialFeature">A feature containing only deltas</param>
    /// <param name="completeOsmGeo">The OSM entity to update</param>
    /// <param name="osmGateway">The gateway to get the user details from</param>
    /// <param name="language">The language to use for the tags</param>
    /// <returns></returns>
    private async Task UpdateWebsitesAndImages(IFeature partialFeature, ICompleteOsmGeo completeOsmGeo, IAuthClient osmGateway, string language)
    {
        var featureAfterTagsUpdates = ConvertOsmToFeature(completeOsmGeo);
        var existingUrls = featureAfterTagsUpdates.Attributes.GetNames()
            .Where(n => n.StartsWith(FeatureAttributes.WEBSITE))
            .Select(p => featureAfterTagsUpdates.Attributes[p].ToString())
            .ToList();
        if (partialFeature.Attributes.Exists(FeatureAttributes.POI_ADDED_URLS))
        {    
            foreach (var url in partialFeature.Attributes[FeatureAttributes.POI_ADDED_URLS] as IEnumerable<object>)
            {
                existingUrls.Add(url.ToString());
            }
        }
        if (partialFeature.Attributes.Exists(FeatureAttributes.POI_REMOVED_URLS))
        {
            var urlsToRemove = (partialFeature.Attributes[FeatureAttributes.POI_REMOVED_URLS] as IEnumerable<object>)
                .Select(u => u.ToString())
                .ToList();
            var wikipediaTagsToRemove = new TagsCollection();
            SetWebsiteAndWikiTags(wikipediaTagsToRemove, urlsToRemove);
            foreach(var urlToRemove in urlsToRemove)
            {
                existingUrls.Remove(urlToRemove);
            }

            foreach (var tag in wikipediaTagsToRemove)
            {
                if (completeOsmGeo.Tags.Contains(tag))
                {
                    completeOsmGeo.Tags.RemoveKeyValue(tag);
                }
            }
        }
        SetWebsiteAndWikiTags(completeOsmGeo.Tags, existingUrls.Distinct().ToList());

        var existingImages = featureAfterTagsUpdates.Attributes.GetNames()
            .Where(n => n.StartsWith(FeatureAttributes.IMAGE_URL))
            .Select(p => featureAfterTagsUpdates.Attributes[p].ToString())
            .ToList();
        if (partialFeature.Attributes.Exists(FeatureAttributes.POI_ADDED_IMAGES))
        {
            var user = await osmGateway.GetUserDetails();
            foreach (var imageUrl in partialFeature.Attributes[FeatureAttributes.POI_ADDED_IMAGES] as IEnumerable<object>)
            {
                existingImages.Add(await UploadImageIfNeeded(imageUrl.ToString(), featureAfterTagsUpdates, language, user.DisplayName));
            }
        }
        if (partialFeature.Attributes.Exists(FeatureAttributes.POI_REMOVED_IMAGES))
        {
            foreach (var imageUrlToRemove in partialFeature.Attributes[FeatureAttributes.POI_REMOVED_IMAGES] as IEnumerable<object>)
            {
                existingImages.Remove(imageUrlToRemove.ToString());
            }
        }
        SetMultipleValuesForTag(completeOsmGeo.Tags, FeatureAttributes.IMAGE_URL, existingImages.Distinct().ToArray());
    }

    private async Task<string[]> UploadImages(IFeature feature, string language, IAuthClient osmGateway)
    {
        var user = await osmGateway.GetUserDetails();
        feature.SetTitles();
        var imageUrls = feature.Attributes.GetNames()
            .Where(n => n.StartsWith(FeatureAttributes.IMAGE_URL))
            .Select(p => feature.Attributes[p].ToString())
            .ToArray();
        var updatedImageUrls = new List<string>();
        foreach (var imageUrl in imageUrls)
        {
            updatedImageUrls.Add(await UploadImageIfNeeded(imageUrl, feature, language, user.DisplayName));
        }
        return updatedImageUrls.ToArray();
    }

    private string GetNonEmptyTitle(string title, string icon)
    {
        return string.IsNullOrWhiteSpace(title)
            ? icon.Replace("icon-", "")
            : title;
    }
        
    private string GetNonEmptyDescription(string description, string nonEmptyTitle)
    {
        return string.IsNullOrWhiteSpace(description)
            ? nonEmptyTitle
            : description;
    }
        
    private async Task<string> UploadImageIfNeeded(string imageUrl,
        IFeature feature, string language, string userDisplayName)
    {
        var icon = feature.Attributes[FeatureAttributes.POI_ICON].ToString();
        var nonEmptyTitle = GetNonEmptyTitle(feature.GetTitle(language), icon);
        var file = _base64ImageConverter.ConvertToFile(imageUrl, nonEmptyTitle);
        if (file == null)
        {
            return imageUrl;
        }
        using var md5 = MD5.Create();
        var imageUrlFromDatabase = await _imageUrlStoreExecutor.GetImageUrlIfExists(md5, file.Content);
        if (imageUrlFromDatabase != null)
        {
            return imageUrlFromDatabase;
        }

        await using var memoryStream = new MemoryStream(file.Content);
        var nonEmptyDescription = GetNonEmptyDescription(feature.GetDescription(language), nonEmptyTitle);
        var imageName = await _wikimediaCommonGateway.UploadImage(file.FileName, nonEmptyDescription, userDisplayName, memoryStream, feature.GetLocation());
        imageUrl = await _wikimediaCommonGateway.GetImageUrl(imageName);
        await _imageUrlStoreExecutor.StoreImage(md5, file.Content, imageUrl);
        return imageUrl;
    }
}