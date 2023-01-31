using IsraelHiking.Common.Poi;
using NetTopologySuite.Features;
using NetTopologySuite.Geometries;
using System.Collections.Generic;
using System.Threading.Tasks;

namespace IsraelHiking.DataAccessInterfaces
{
    public interface IWikipediaGateway: IInitializable
    {
        Task<List<IFeature>> GetByBoundingBox(Coordinate sourhWest, Coordinate northEast, string language);
        Reference GetReference(string title, string language);
        Task<List<IFeature>> GetByPagesTitles(string[] titles, string language);
    }
}
