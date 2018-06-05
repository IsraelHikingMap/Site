using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using IsraelHiking.Common;

namespace IsraelHiking.API.Services.Poi
{
    /// <inheritdoc />
    public class PointsOfInterestAggregatorService : IPointsOfInterestAggregatorService
    {
        private readonly Dictionary<string, IPointsOfInterestAdapter> _adapters;

        /// <summary>
        /// Constructor
        /// </summary>
        /// <param name="adapters"></param>
        public PointsOfInterestAggregatorService(IEnumerable<IPointsOfInterestAdapter> adapters)
        {
            _adapters = adapters.ToDictionary(a => a.Source, a => a);
        }

        /// <inheritdoc />
        public async Task<PointOfInterestExtended> Get(string source, string id, string language = "")
        {
            if (_adapters.ContainsKey(source) == false)
            {
                return null;
            }
            var adapter = _adapters[source];
            var poiItem = await adapter.GetPointOfInterestById(id, language);
            if (poiItem == null)
            {
                return null;
            }
            if (poiItem.CombinedIds == null)
            {
                return poiItem;
            }
            foreach (var poiItemCombinedIdKey in poiItem.CombinedIds.Keys)
            {
                adapter = _adapters[poiItemCombinedIdKey];
                foreach (var currentId in poiItem.CombinedIds[poiItemCombinedIdKey])
                {
                    var currentPoiItem = await adapter.GetPointOfInterestById(currentId, language);
                    if (currentPoiItem == null)
                    {
                        continue;
                    }
                    if (string.IsNullOrWhiteSpace(poiItem.Description))
                    {
                        poiItem.Description = currentPoiItem.Description;
                    }
                    poiItem.ImagesUrls = poiItem.ImagesUrls.Concat(currentPoiItem.ImagesUrls)
                        .Distinct()
                        .ToArray();
                    poiItem.References = poiItem.References.Concat(currentPoiItem.References)
                        .GroupBy(r => r.Url)
                        .Select(r => r.FirstOrDefault())
                        .ToArray();
                }
            }
            return poiItem;
        }
    }
}
