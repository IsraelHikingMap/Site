using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Net.Http;
using System.Text;
using System.Threading.Tasks;
using IsraelHiking.DataAccessInterfaces;

namespace IsraelHiking.API.Services
{
    public class UpdateOsmDataTask
    {
        private readonly ILogger _logger;
        private readonly IGraphHopperHelper _graphHopperHelper;

        public UpdateOsmDataTask(ILogger logger,  IGraphHopperHelper graphHopperHelper)
        {
            _logger = logger;
            _graphHopperHelper = graphHopperHelper;
        }

        public Task Update()
        {
            return null;
        }
    }
}
