using System.Collections.Generic;
using System.IO;
using System.Threading.Tasks;
using IsraelHiking.API.Services;
using IsraelHiking.API.Swagger;
using IsraelHiking.Common;
using IsraelHiking.DataAccessInterfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Swashbuckle.AspNetCore.SwaggerGen;

namespace IsraelHiking.API.Controllers
{
    /// <summary>
    /// This controller is responsible for managing OSM traces
    /// </summary>
    [Route("api/osm/trace")]
    public class OsmTracesController : Controller
    {
        private readonly IHttpGatewayFactory _httpGatewayFactory;
        private readonly LruCache<string, TokenAndSecret> _cache;

        /// <summary>
        /// Controller's constructor
        /// </summary>
        /// <param name="httpGatewayFactory"></param>
        /// <param name="cache"></param>
        public OsmTracesController(IHttpGatewayFactory httpGatewayFactory, 
            LruCache<string, TokenAndSecret> cache)
        {
            _httpGatewayFactory = httpGatewayFactory;
            _cache = cache;
        }

        /// <summary>
        /// Get OSM user traces
        /// </summary>
        /// <returns>A list of traces</returns>
        [Authorize]
        [HttpGet]
        public Task<List<OsmTrace>> GetTraces()
        {
            var gateway = _httpGatewayFactory.CreateOsmGateway(_cache.Get(User.Identity.Name));
            return gateway.GetTraces();
        }
        
        
        /// <summary>
        /// Allows upload of traces to OSM
        /// </summary>
        /// <returns></returns>
        [Authorize]
        [HttpPost]
        [SwaggerOperationFilter(typeof(RequiredFileUploadParams))]
        public async Task<IActionResult> PostUploadGpsTrace(IFormFile file)
        {
            if (file == null)
            {
                return new BadRequestResult();
            }
            using (var memoryStream = new MemoryStream())
            {
                await file.CopyToAsync(memoryStream);
                var gateway = _httpGatewayFactory.CreateOsmGateway(_cache.Get(User.Identity.Name));
                await gateway.CreateTrace(file.FileName, new MemoryStream(memoryStream.ToArray()));
            }
            return Ok();
        }

        /// <summary>
        /// Allows update OSM trace meta data
        /// </summary>
        /// <param name="id">The Id of the trace</param>
        /// <param name="trace">The trace data</param>
        /// <returns></returns>
        [Authorize]
        [Route("{id}")]
        [HttpPut]
        public async Task<IActionResult> PutGpsTrace(string id, [FromBody]OsmTrace trace)
        {
            var gateway = _httpGatewayFactory.CreateOsmGateway(_cache.Get(User.Identity.Name));
            await gateway.UpdateTrace(trace);
            return Ok();
        }

        /// <summary>
        /// Allows the deletion of OSM trace
        /// </summary>
        /// <param name="id">The Id of the trace</param>
        /// <returns></returns>
        [Authorize]
        [Route("{id}")]
        [HttpDelete]
        public async Task<IActionResult> DeleteGpsTrace(string id)
        {
            var gateway = _httpGatewayFactory.CreateOsmGateway(_cache.Get(User.Identity.Name));
            await gateway.DeleteTrace(id);
            return Ok();
        }
    }
}
