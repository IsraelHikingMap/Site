using System;
using System.Net.Http;
using System.Threading.Tasks;
using System.Web.Http;
using IsraelHiking.DataAccessInterfaces;

namespace IsraelHiking.API.Controllers
{
    public class UpdateDataController : ApiController
    {
        private readonly ILogger _logger;
        private readonly IGraphHopperHelper _graphHopperHelper;

        public UpdateDataController(ILogger logger, IGraphHopperHelper graphHopperHelper)
        {
            _logger = logger;
            _graphHopperHelper = graphHopperHelper;
        }

        // GET api/UpdateData
        public async Task<IHttpActionResult> GetUpdateDataRequest()
        {
            if (Request.IsLocal() == false)
            {
                _logger.Warn("Trying to call update data from non-local machine...");
                return NotFound();
            }
            await _graphHopperHelper.UpdateData();
            return Ok("Data updated succefully at " + DateTime.Now.ToLongDateString());
        }
    }
}
