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
            _logger.LogInformation("Total rating: " + ratings.Count);
            ratings = ratings.Where(r => r.Source.Equals(Sources.OSM)).ToList();
            _logger.LogInformation("Rating to fix: " + ratings.Count);
            foreach (var rating in ratings)
            {
                if (!rating.Id.Contains("_"))
                {
                    _logger.LogInformation("Deleteing for id: " + rating.Id);
                    await _elasticSearchGateway.DeleteRating(rating);
                    continue;
                }
                var type = rating.Id.Split("_").First();
                var id = rating.Id.Split("_").Last();
                
                var element = await osmGateway.GetElement(id, type);
                if (element == null)
                {
                    _logger.LogInformation("Deleteing for id: " + rating.Id);
                    await _elasticSearchGateway.DeleteRating(rating);
                }
                foreach (var typeToCheck in new [] { "node", "way", "relation"})
                {
                    var latLng = new LatLng();
                    switch (typeToCheck)
                    {
                        case "node":
                            var node = await osmGateway.GetNode(id);
                            if (node != null)
                            {
                                latLng.Lat = node.Latitude.Value;
                                latLng.Lng = node.Longitude.Value;
                            }
                            break;
                        case "way":
                            var way = await osmGateway.GetCompleteWay(id);
                            if (way != null)
                            {
                                latLng.Lat = way.Nodes.First().Latitude.Value;
                                latLng.Lng = way.Nodes.First().Longitude.Value;
                            }
                            break;
                        case "relation":
                            continue;
                    }
                    if (latLng.Lat >= 28 &&
                        latLng.Lat <= 32 &&
                        latLng.Lng >= 33 &&
                        latLng.Lng <= 35)
                    {
                        _logger.LogInformation("Update: https://www.openstreetmap.org/" + typeToCheck + "/" + id);
                        rating.Id = typeToCheck + "_" + id;
                        await _elasticSearchGateway.UpdateRating(rating);
                    }
                    else
                    {
                        rating.Id = typeToCheck + "_" + id;
                        _logger.LogInformation("Deleteing for id: " + rating.Id);
                        await _elasticSearchGateway.DeleteRating(rating);
                    }
                }
            }
            _logger.LogInformation("Finished rating fixing");
            return Ok();
        }
    }
}
