using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using IsraelHiking.Common;

namespace IsraelHiking.API.Services.Poi
{
    /// <inheritdoc />
    public class PointsOfInterestAggregatorService : IPointsOfInterestAggregatorService
    {
        private readonly IPointsOfInterestAdapterFactory _pointsOfInterestAdapterFactory;

        /// <summary>
        /// Constructor
        /// </summary>
        /// <param name="pointsOfInterestAdapterFactory"></param>
        public PointsOfInterestAggregatorService(IPointsOfInterestAdapterFactory pointsOfInterestAdapterFactory)
        {
            _pointsOfInterestAdapterFactory = pointsOfInterestAdapterFactory;
        }

        /// <inheritdoc />
        public async Task<PointOfInterestExtended> Get(string source, string id, string language = "")
        {
            var adapter = _pointsOfInterestAdapterFactory.GetBySource(source);
            if (adapter == null)
            {
                return null;
            }
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
                adapter = _pointsOfInterestAdapterFactory.GetBySource(poiItemCombinedIdKey);
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
