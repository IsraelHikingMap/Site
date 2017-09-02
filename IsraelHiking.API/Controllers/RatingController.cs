using System.Linq;
using System.Threading.Tasks;
using IsraelHiking.Common;
using IsraelHiking.DataAccessInterfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace IsraelHiking.API.Controllers
{
    /// <summary>
    /// This controller handles rating
    /// </summary>
    [Route("api/[controller]")]
    public class RatingController : Controller
    {
        private readonly IElasticSearchGateway _elasticSearchGateway;

        /// <summary>
        /// Constructor
        /// </summary>
        /// <param name="elasticSearchGateway"></param>
        public RatingController(IElasticSearchGateway elasticSearchGateway)
        {
            _elasticSearchGateway = elasticSearchGateway;
        }

        /// <summary>
        /// Get rating of a point of interest
        /// </summary>
        /// <param name="id">The ID of the point of interest</param>
        /// <param name="source">The source of the point of interest</param>
        /// <returns></returns>
        [HttpGet]
        [Route("{source}/{id}")]
        [ProducesResponseType(typeof(Rating), 200)]
        public async Task<IActionResult> GetRating(string id, string source)
        {
            if (string.IsNullOrWhiteSpace(source))
            {
                return BadRequest("Source is missing.");
            }
            if (string.IsNullOrWhiteSpace(id))
            {
                return BadRequest("Id is missing.");
            }
            return Ok(await _elasticSearchGateway.GetRating(id, source));
        }

        /// <summary>
        /// Creates or updates rating
        /// </summary>
        /// <param name="rating">The <see cref="Rating"/></param>
        /// <returns></returns>
        [Authorize]
        [HttpPost]
        [Route("")]
        public async Task<IActionResult> UploadRating([FromBody] Rating rating)
        {
            if (string.IsNullOrWhiteSpace(rating.Source))
            {
                return BadRequest("Source is missing.");
            }
            if (string.IsNullOrWhiteSpace(rating.Id))
            {
                return BadRequest("Id is missing.");
            }
            var ratingFromDatabase = await _elasticSearchGateway.GetRating(rating.Id, rating.Source);
            if (ratingFromDatabase.Raters.FirstOrDefault(r => r.Id == User.Identity.Name) != null)
            {
                return BadRequest("User already rated this item.");
            }
            var rater = rating.Raters.FirstOrDefault(r => r.Id == User.Identity.Name);
            if (rater == null)
            {
                return BadRequest("Invalid rating, new rating's raters should contain logged in user");
            }
            ratingFromDatabase.Raters.Add(rater);
            await _elasticSearchGateway.UpdateRating(ratingFromDatabase);
            return Ok(ratingFromDatabase);
        }
    }
}
