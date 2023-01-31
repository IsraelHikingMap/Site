using IsraelHiking.Common;
using IsraelHiking.Common.Extensions;
using IsraelHiking.DataAccessInterfaces;
using Microsoft.Extensions.Logging;
using NetTopologySuite.Features;
using NetTopologySuite.Geometries;
using System;
using System.Collections.Concurrent;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;

namespace IsraelHiking.API.Services.Poi
{
    /// <summary>
    /// Points of interest adapter for Wikipedia data
    /// </summary>
    public class WikipediaPointsOfInterestAdapter : IPointsOfInterestAdapter
    {
        private readonly IWikipediaGateway _wikipediaGateway;
        private readonly IOverpassTurboGateway _overpassTurboGateway;
        private readonly ILogger _logger;

        /// <summary>
        /// Class constructor
        /// </summary>
        /// <param name="wikipediaGateway"></param>
        /// <param name="overpassTurboGateway"></param>
        /// <param name="logger"></param>
        public WikipediaPointsOfInterestAdapter(IWikipediaGateway wikipediaGateway,
            IOverpassTurboGateway overpassTurboGateway,
            ILogger logger)
        {
            _wikipediaGateway = wikipediaGateway;
            _overpassTurboGateway = overpassTurboGateway;
            _logger = logger;
        }

        /// <inheritdoc />
        public string Source => Sources.WIKIPEDIA;

        /// <inheritdoc />
        public async Task<List<IFeature>> GetAll()
        {
            _logger.LogInformation("Start getting Wikipedia pages for indexing.");
            var allLinkedWikipedia = await _overpassTurboGateway.GetWikipediaLinkedTitles();
            _logger.LogInformation($"Got {allLinkedWikipedia.Count} linked wikipedia titles from overpass turbo.");
            var startCoordinate = new Coordinate(34, 29);
            var endCoordinate = new Coordinate(36, 34);
            double step = 0.15; // bigger step causes wiki toobig exception...
            var coordinatesList = new List<Coordinate>();
            var currentCoordinate = new Coordinate();

            for (
                currentCoordinate.X = startCoordinate.X;
                currentCoordinate.X < endCoordinate.X;
                currentCoordinate.X += step
                )
            {
                for (
                    currentCoordinate.Y = startCoordinate.Y;
                    currentCoordinate.Y < endCoordinate.Y;
                    currentCoordinate.Y += step
                    )
                {
                    coordinatesList.Add(currentCoordinate.Copy());
                }
            }

            _logger.LogInformation($"Created {coordinatesList.Count} coordinates centers to fetch Wikipedia data.");
            var allFeatures = new List<IFeature>();
            foreach (var language in Languages.Array)
            {
                var lists = new ConcurrentBag<List<IFeature>>();
                await Task.Run(() =>
                {
                    Parallel.ForEach(coordinatesList, new ParallelOptions { MaxDegreeOfParallelism = 10 }, (coordinate) =>
                    {
                        lists.Add(_wikipediaGateway.GetByBoundingBox(coordinate, new Coordinate(coordinate.X + step, coordinate.Y + step), language).Result);
                    });
                }).ConfigureAwait(false);
                var wikiFeaturesTitles = lists.SelectMany(l => l)
                    .GroupBy(f => f.GetId())
                    .Select(g => g.First().Attributes[FeatureAttributes.NAME].ToString())
                    .Concat(allLinkedWikipedia.Where(n => n.StartsWith(language))
                        .Select(n => n.Replace($"{language}:", string.Empty)))
                    .Distinct()
                    .ToList();
                _logger.LogInformation($"Got {wikiFeaturesTitles.Count} wiki pages for language: {language}, getting full data");
                var requests = 200;
                var pageSize = wikiFeaturesTitles.Count / requests + 1;
                lists = new ConcurrentBag<List<IFeature>>();
                await Task.Run(() =>
                {
                    Parallel.For(0, requests, new ParallelOptions { MaxDegreeOfParallelism = 10 }, (requestNumber) =>
                    {
                        var titles = wikiFeaturesTitles.Skip(requestNumber * pageSize)
                            .Take(pageSize)
                            .ToArray();
                        lists.Add(_wikipediaGateway.GetByPagesTitles(titles, language).Result);
                    });
                }).ConfigureAwait(false);
                var features = lists.SelectMany(l => l).GroupBy(f => f.GetId()).Select(g => g.First()).ToList();
                allFeatures.AddRange(features);
                _logger.LogInformation($"Finished getting full data for language: {language}, {features.Count}");
            }
            _logger.LogInformation($"Finished getting Wikipedia pages for indexing, got {allFeatures.Count} pages.");
            return allFeatures;
        }

        /// <inheritdoc />
        public async Task<List<IFeature>> GetUpdates(DateTime lastModifiedDate)
        {
            var features = await GetAll();
            // The features with the invalid location might be added by editing an OSM element,
            // in that case we need to return them as well. Since we simply bring all of them here,
            // there's no easy way to know when the OSM element linking to them has been updated.
            // So the "hack" here is to return those without a location always.
            return features.Where(f => f.GetLastModified() > lastModifiedDate || f.GetLocation().X.Equals(FeatureAttributes.INVALID_LOCATION)).ToList();
        }
    }
}
