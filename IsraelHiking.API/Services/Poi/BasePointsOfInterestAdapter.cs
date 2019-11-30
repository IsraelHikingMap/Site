using Microsoft.Extensions.Logging;
using NetTopologySuite.Features;
using System.Collections.Generic;
using System.Threading.Tasks;

namespace IsraelHiking.API.Services.Poi
{
    /// <inheritdoc />
    /// <summary>
    /// Base class for points of interest adapter
    /// </summary>
    public abstract class BasePointsOfInterestAdapter : IPointsOfInterestAdapter
    {
        /// <summary>
        /// Logger
        /// </summary>
        protected readonly ILogger _logger;
        /// <summary>
        /// Data container service used to convert the data
        /// </summary>
        protected readonly IDataContainerConverterService _dataContainerConverterService;

        /// <inheritdoc />
        public abstract string Source { get; }
        /// <inheritdoc />
        public abstract Task<List<Feature>> GetPointsForIndexing();

        /// <inheritdoc />
        public abstract Task<Feature> GetRawPointOfInterestById(string id);

        /// <summary>
        /// Adapter's constructor
        /// </summary>
        /// <param name="dataContainerConverterService"></param>
        /// <param name="logger"></param>
        protected BasePointsOfInterestAdapter(IDataContainerConverterService dataContainerConverterService,
            ILogger logger)
        {
            _dataContainerConverterService = dataContainerConverterService;
            _logger = logger;
        }
    }
}
