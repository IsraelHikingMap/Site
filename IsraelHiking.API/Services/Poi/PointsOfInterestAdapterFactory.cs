using System;
using System.Collections.Generic;
using System.Linq;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.FileProviders;

namespace IsraelHiking.API.Services.Poi
{
    /// <inheritdoc />
    public class PointsOfInterestAdapterFactory : IPointsOfInterestAdapterFactory
    {
        private readonly IServiceProvider _serviceProvider;
        private readonly IFileProvider _fileProvider;
        private readonly List<IPointsOfInterestAdapter> _adapters;

        /// <summary>
        /// Constructor, reads from CSV folder to create dynamic adapters
        /// </summary>
        /// <param name="adapters"></param>
        /// <param name="serviceProvider"></param>
        /// <param name="fileProvider"></param>
        public PointsOfInterestAdapterFactory(
            IEnumerable<IPointsOfInterestAdapter> adapters,
            IServiceProvider serviceProvider,
            IFileProvider fileProvider)
        {
            _serviceProvider = serviceProvider;
            _fileProvider = fileProvider;
            _adapters = adapters.ToList();
            foreach (var file in fileProvider.GetDirectoryContents(CsvPointsOfInterestAdapter.CSV_DIRECTORY))
            {
                var csvAdapter = serviceProvider.GetRequiredService<CsvPointsOfInterestAdapter>();
                csvAdapter.SetFileName(file.Name);
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
            // refreshing csv list
            var removeList = _adapters.OfType<CsvPointsOfInterestAdapter>().ToList();
            foreach (var csvPointsOfInterestAdapter in removeList)
            {
                _adapters.Remove(csvPointsOfInterestAdapter);
            }
            foreach (var file in _fileProvider.GetDirectoryContents(CsvPointsOfInterestAdapter.CSV_DIRECTORY))
            {
                var csvAdapter = _serviceProvider.GetRequiredService<CsvPointsOfInterestAdapter>();
                csvAdapter.SetFileName(file.Name);
                _adapters.Add(csvAdapter);
            }
            return _adapters;
        }
    }
}
