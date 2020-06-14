using IsraelHiking.Common.Poi;
using NetTopologySuite.Features;
using NetTopologySuite.Geometries;
using System.Collections.Generic;
using System.Threading.Tasks;

namespace IsraelHiking.DataAccessInterfaces
{
    public interface IWikipediaGateway
    {
        Task Initialize();
        Task<List<Feature>> GetByBoundingBox(Coordinate sourhWest, Coordinate northEast, string language);
        Reference GetReference(string title, string language);
        Task<List<Feature>> GetByPagesTitles(string[] titles, string language);
    }
}
