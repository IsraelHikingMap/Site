using System.Linq;
using System.Threading.Tasks;
using IsraelHiking.Common;
using IsraelHiking.DataAccessInterfaces;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Logging;

namespace IsraelHiking.API.Controllers
{
    /// <summary>
    /// Fixes ratings - temporary.
    /// </summary>
    [Route("api/[controller]")]
    public class FixRatingsController : Controller
    {
        private readonly IElasticSearchGateway _elasticSearchGateway;
        private readonly IHttpGatewayFactory _httpGatewayFactory;
        private readonly ILogger _logger;

        /// <summary>
        /// Class constructor
        /// </summary>
        /// <param name="elasticSearchGateway"></param>
        /// <param name="httpGatewayFactory"></param>
        /// <param name="logger"></param>
        public FixRatingsController(IElasticSearchGateway elasticSearchGateway,
            IHttpGatewayFactory httpGatewayFactory,
            ILogger logger)
        {
            _elasticSearchGateway = elasticSearchGateway;
            _httpGatewayFactory = httpGatewayFactory;
            _logger = logger;
        }

        /// <summary>
        /// Main function to call to fix ratings database
        /// </summary>
        /// <returns></returns>
        [HttpGet]
        public async Task<IActionResult> GetFixRatings()
        {
            _logger.LogInformation("Starting rating fixing");
            var osmGateway = _httpGatewayFactory.CreateOsmGateway(null);
            var ratings = await _elasticSearchGateway.GetRatings();
            _logger.LogInformation("Rating to fix: " + ratings.Count);
            foreach (var rating in ratings)
            {
                if (rating.Source != Sources.OSM)
                {
                    continue;
                }

                if (!rating.Id.StartsWith("node"))
                {
                    continue;
                }
                var id = rating.Id.Split("_").Last();
                
                var node = await osmGateway.GetNode(id);
                if (node == null)
                {
                    continue;
                }

                if (node.Latitude >= 28 &&
                    node.Latitude <= 32 &&
                    node.Longitude >= 33 &&
                    node.Longitude <= 35)
                {
                    continue;
                }

                _logger.LogInformation("https://www.openstreetmap.org/way/" + id);
                rating.Id = "way_" + id;
                await _elasticSearchGateway.UpdateRating(rating);
            }
            _logger.LogInformation("Finished rating fixing");
            return Ok();
        }
    }
}
