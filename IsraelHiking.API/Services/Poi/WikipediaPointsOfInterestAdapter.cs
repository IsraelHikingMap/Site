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
        private readonly ILogger _logger;

        /// <summary>
        /// Class constructor
        /// </summary>
        /// <param name="wikipediaGateway"></param>
        /// <param name="logger"></param>
        public WikipediaPointsOfInterestAdapter(IWikipediaGateway wikipediaGateway,
            ILogger logger)
        {
            _wikipediaGateway = wikipediaGateway;
            _logger = logger;
        }

        /// <inheritdoc />
        public string Source => Sources.WIKIPEDIA;

        /// <inheritdoc />
        public async Task<List<Feature>> GetAll()
        {
            _logger.LogInformation("Start getting Wikipedia pages for indexing.");
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
            var allFeatures = new List<Feature>();
            foreach (var language in Languages.Array)
            {
                var lists = new ConcurrentBag<List<Feature>>();
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
                    .ToList();
                _logger.LogInformation($"Got {wikiFeaturesTitles.Count} wiki pages for language: {language}, getting full data");
                var requests = 200;
                var pageSize = wikiFeaturesTitles.Count / requests + 1;
                lists = new ConcurrentBag<List<Feature>>();
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
                allFeatures.AddRange(lists.SelectMany(l => l).GroupBy(f => f.GetId()).Select(g => g.First()).ToList());
                _logger.LogInformation($"Finished getting full data for language: {language}");
            }
            _logger.LogInformation($"Finished getting Wikipedia pages for indexing, got {allFeatures.Count} pages.");
            return allFeatures;
        }

        /// <inheritdoc />
        public async Task<List<Feature>> GetUpdates(DateTime lastMoidifiedDate)
        {
            var features = await GetAll();
            return features.Where(f => f.GetLastModified() > lastMoidifiedDate).ToList();
        }
    }
}
