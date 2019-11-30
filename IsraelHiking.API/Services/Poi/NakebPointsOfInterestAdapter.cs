using System.Collections.Generic;
using System.Threading.Tasks;
using IsraelHiking.Common;
using IsraelHiking.DataAccessInterfaces;
using Microsoft.Extensions.Logging;
using NetTopologySuite.Features;

namespace IsraelHiking.API.Services.Poi
{
    /// <summary>
    /// Adapts from nakeb interface to business logic point of interest
    /// </summary>
    public class NakebPointsOfInterestAdapter : BasePointsOfInterestAdapter
    {
        /// <inheritdoc />
        public override string Source => Sources.NAKEB;

        private readonly INakebGateway _nakebGateway;

        /// <summary>
        /// Constructor
        /// </summary>
        /// <param name="nakebGateway"></param>
        /// <param name="dataContainerConverterService"></param>
        /// <param name="logger"></param>
        public NakebPointsOfInterestAdapter(INakebGateway nakebGateway,
            IDataContainerConverterService dataContainerConverterService,
            ILogger logger) :
            base(dataContainerConverterService,
                logger)
        {
            _nakebGateway = nakebGateway;
        }

        /// <inheritdoc />
        public override async Task<List<Feature>> GetPointsForIndexing()
        {
            _logger.LogInformation("Getting data from Nakeb.");
            var features = await _nakebGateway.GetAll();
            _logger.LogInformation($"Got {features.Count} routes from Nakeb.");
            return features;
        }

        /// <inheritdoc />
        public override Task<Feature> GetRawPointOfInterestById(string id)
        {
            return _nakebGateway.GetById(id);
        }
    }
}
