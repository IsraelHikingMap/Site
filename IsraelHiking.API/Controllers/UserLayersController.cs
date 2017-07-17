using System.Collections.Generic;
using System.Threading.Tasks;
using IsraelHiking.Common;
using IsraelHiking.DataAccessInterfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace IsraelHiking.API.Controllers
{
    /// <summary>
    /// This controller handles the user custom layers
    /// </summary>
    [Route("api/[controller]")]
    public class UserLayersController : Controller
    {
        private IIsraelHikingRepository _repository;

        /// <summary>
        /// Controller's constructor
        /// </summary>
        /// <param name="repository"></param>
        public UserLayersController(IIsraelHikingRepository repository)
        {
            _repository = repository;
        }

        /// <summary>
        /// Gets the user's custom layers
        /// </summary>
        /// <returns></returns>
        [Authorize]
        [HttpGet]
        [ProducesResponseType(typeof(IEnumerable<UserLayers>), 200)]
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
        [ProducesResponseType(typeof(UserLayers), 200)]
        public async Task<IActionResult> PostUserLayers(string osmUserId, [FromBody] UserLayers userLayers)
        {
            if (osmUserId != User.Identity.Name)
            {
                return Unauthorized();
            }
            await _repository.UpdateUserLayers(User.Identity.Name, userLayers);
            return Ok(userLayers);
        }

        /// <summary>
        /// Follows dispose pattern
        /// </summary>
        /// <param name="disposing"></param>
        protected override void Dispose(bool disposing)
        {
            if (disposing && _repository != null)
            {
                _repository.Dispose();
                _repository = null;
            }

            base.Dispose(disposing);
        }
    }
}
