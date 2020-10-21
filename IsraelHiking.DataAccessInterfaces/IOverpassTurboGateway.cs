using System.Collections.Generic;
using System.Threading.Tasks;

namespace IsraelHiking.DataAccessInterfaces
{
    public interface IOverpassTurboGateway
    {
        Task<List<string>> GetWikipediaLinkedTitles();
    }
}