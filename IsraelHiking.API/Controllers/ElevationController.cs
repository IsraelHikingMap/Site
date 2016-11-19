using IsraelHiking.DataAccessInterfaces;
using System.Linq;
using System.Threading.Tasks;
using System.Web.Http;
using IsraelHiking.Common;

namespace IsraelHiking.API.Controllers
{
    public class ElevationController : ApiController
    {
        private readonly IElevationDataStorage _elevationDataStorage;

        public ElevationController(IElevationDataStorage elevationDataStorage)
        {
            _elevationDataStorage = elevationDataStorage;
        }

        // GET api/elevation?point=31.8239,35.0375&point=31.8213,35.0965
        public async Task<double[]> GetElevation([FromUri]string[] point)
        {
            var tasks = point.Select(async p => await _elevationDataStorage.GetElevation(new LatLng(p)));
            return await Task.WhenAll(tasks);
        }
    }
}
