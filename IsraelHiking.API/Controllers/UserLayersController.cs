using System.Collections.Generic;
using System.Threading.Tasks;
using IsraelHiking.Common;
using IsraelHiking.DataAccessInterfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace IsraelHiking.API.Controllers
{
    /// <inheritdoc />
    /// <summary>
    /// This controller handles the user custom layers
    /// </summary>
    [Route("api/[controller]")]
    public class UserLayersController : Controller
    {
        private readonly IRepository _repository;

        /// <summary>
        /// Controller's constructor
        /// </summary>
        /// <param name="repository"></param>
        public UserLayersController(IRepository repository)
        {
            _repository = repository;
        }

        /// <summary>
        /// Gets the user's custom layers
        /// </summary>
        /// <returns></returns>
        [Authorize]
        [HttpGet]
        [ProducesResponseType(typeof(IEnumerable<UserMapLayers>), 200)]
        public async Task<IActionResult> GetUserLayers()
        {
            var userLayers = await _repository.GetUserLayers(User.Identity.Name);
            return Ok(userLayers);
        }

        /// <summary>
        /// Updates the user's custom layers in the database
        /// </summary>
        /// <param name="osmUserId"></param>
        /// <param name="userLayers"></param>
        /// <returns></returns>
        [Authorize]
        [HttpPost]
        [Route("{osmUserId}")]
        [ProducesResponseType(typeof(UserMapLayers), 200)]
        public async Task<IActionResult> PostUserLayers(string osmUserId, [FromBody] UserMapLayers userLayers)
        {
            if (string.IsNullOrWhiteSpace(osmUserId) || osmUserId != User.Identity.Name)
            {
                return BadRequest();
            }
            await _repository.UpdateUserLayers(User.Identity.Name, userLayers);
            return Ok(userLayers);
        }
    }
}
