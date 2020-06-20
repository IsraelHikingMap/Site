using System;
using System.Collections.Generic;
using System.Linq;
using IsraelHiking.Common.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Options;

namespace IsraelHiking.API.Services.Poi
{
    /// <inheritdoc />
    public class PointsOfInterestAdapterFactory : IPointsOfInterestAdapterFactory
    {
        private readonly List<IPointsOfInterestAdapter> _adapters;
        private readonly ConfigurationData _options;

        /// <summary>
        /// Constructor, reads from CSV folder to create dynamic adapters
        /// </summary>
        /// <param name="adapters"></param>
        /// <param name="serviceProvider"></param>
        /// <param name="options"></param>
        public PointsOfInterestAdapterFactory(
            IEnumerable<IPointsOfInterestAdapter> adapters,
            IServiceProvider serviceProvider,
            IOptions<ConfigurationData> options)
        {
            _adapters = adapters.ToList();
            _options = options.Value;
            foreach (var file in _options.CsvsDictionary.Keys)
            {
                var csvAdapter = serviceProvider.GetRequiredService<CsvPointsOfInterestAdapter>();
                csvAdapter.SetFileNameAndAddress(file, _options.CsvsDictionary[file]);
                _adapters.Add(csvAdapter);
            }
        }

        /// <inheritdoc />
        public IPointsOfInterestAdapter GetBySource(string source)
        {
            return _adapters.FirstOrDefault(a => a.Source.Equals(source, StringComparison.InvariantCultureIgnoreCase));
        }

        /// <inheritdoc />
        public IEnumerable<IPointsOfInterestAdapter> GetAll()
        {
            return _adapters;
        }
    }
}
