using IsraelHiking.Common.Poi;
using NetTopologySuite.Geometries;
using System.Collections.Generic;
using System.Threading.Tasks;

namespace IsraelHiking.DataAccessInterfaces.Repositories;

public interface ISearchRepository
{
    Task<List<SearchResultsPointOfInterest>> Search(string searchTerm, string language,
        double? lat = null, double? lng = null, double? zoom = null, bool prefix = false);
    Task<List<SearchResultsPointOfInterest>> SearchPlaces(string searchTerm, string language,
        double? lat = null, double? lng = null, double? zoom = null, bool prefix = false);
    Task<List<SearchResultsPointOfInterest>> SearchExact(string searchTerm, string language);
    Task<string> GetContainerName(Coordinate[] coordinates, string language);
}