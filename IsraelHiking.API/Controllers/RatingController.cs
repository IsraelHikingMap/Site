using IsraelHiking.Common;
using IsraelHiking.DataAccessInterfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Linq;
using System.Threading.Tasks;

namespace IsraelHiking.API.Controllers
{
    /// <summary>
    /// This controller handles rating
    /// </summary>
    [Route("api/[controller]")]
    public class RatingController : ControllerBase
    {
        private readonly IRepository _repository;

        /// <summary>
        /// Constructor
        /// </summary>
        /// <param name="repository"></param>
        public RatingController(IRepository repository)
        {
            _repository = repository;
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
            if (string.IsNullOrWhiteSpace(id))
            {
                return BadRequest("Id is missing.");
            }
            if (string.IsNullOrWhiteSpace(source))
            {
                return BadRequest("Source is missing.");
            }
            return Ok(await _repository.GetRating(id, source));
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
            if (string.IsNullOrWhiteSpace(rating.Id))
            {
                return BadRequest("Id is missing.");
            }
            if (string.IsNullOrWhiteSpace(rating.Source))
            {
                return BadRequest("Source is missing.");
            }
            var rater = rating.Raters.FirstOrDefault(r => r.Id == User.Identity.Name);
            if (rater == null)
            {
                return BadRequest("Invalid rating, new rating's raters should contain logged in user");
            }
            var ratingFromDatabase = await _repository.GetRating(rating.Id, rating.Source);
            var raterFromDatabase = ratingFromDatabase.Raters.FirstOrDefault(r => r.Id == User.Identity.Name);
            if (raterFromDatabase != null)
            {
                ratingFromDatabase.Raters.Remove(raterFromDatabase);
            }
            ratingFromDatabase.Raters.Add(rater);
            await _repository.UpdateRating(ratingFromDatabase);
            return Ok(ratingFromDatabase);
        }
    }
}
