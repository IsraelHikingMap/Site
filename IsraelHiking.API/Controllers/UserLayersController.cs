using System.Collections.Generic;
using System.Linq;
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
        [ProducesResponseType(typeof(IEnumerable<MapLayerData>), 200)]
        public async Task<IActionResult> GetUserLayers()
        {
            var userLayers = await _repository.GetUserLayers(User.Identity.Name);
            return Ok(userLayers);
        }

        /// <summary>
        /// Adds a custom user layer to database
        /// </summary>
        /// <param name="mapLayer">The map layer to add</param>
        /// <returns></returns>
        [Authorize]
        [HttpPost]
        [ProducesResponseType(typeof(MapLayerData), 200)]
        public async Task<IActionResult> PostUserLayer([FromBody]MapLayerData mapLayer)
        {
            var validation = IsValidMapLayer(mapLayer);
            if (validation != string.Empty)
            {
                return BadRequest(validation);
            }
            mapLayer.OsmUserId = User.Identity.Name;
            var response = await _repository.AddUserLayer(mapLayer);
            return Ok(response);
        }

        /// <summary>
        /// Updates a custom user layer
        /// </summary>
        /// <param name="id"></param>
        /// <param name="mapLayer"></param>
        /// <returns></returns>
        [Authorize]
        [HttpPut]
        [Route("{id}")]
        public async Task<IActionResult> PutUserLayer(string id, [FromBody]MapLayerData mapLayer)
        {
            var validationResults = await ValidateInput(id, mapLayer);
            if (validationResults != null)
            {
                return validationResults;
            }
            await _repository.UpdateUserLayer(mapLayer);
            return Ok(mapLayer);
        }

        /// <summary>
        /// Deletes a custom user layer
        /// </summary>
        /// <param name="id"></param>
        /// <param name="mapLayer">The layer to delete</param>
        /// <returns></returns>
        [Authorize]
        [HttpDelete]
        [Route("{id}")]
        public async Task<IActionResult> DeleteUserLayer(string id)
        {
            var mapLayer = await _repository.GetUserLayerById(id);
            if (mapLayer == null)
            {
                return NotFound();
            }
            var validationResults = await ValidateInput(id, mapLayer);
            if (validationResults != null)
            {
                return validationResults;
            }
            await _repository.DeleteUserLayer(mapLayer);
            return Ok(mapLayer);
        }

        private string IsValidMapLayer(MapLayerData mapLayer)
        {
            if (string.IsNullOrWhiteSpace(mapLayer.Key))
            {
                return "key cannot be empty";
            }
            if (string.IsNullOrWhiteSpace(mapLayer.Address))
            {
                return "address cannot be empty";
            }
            return string.Empty;
        }

        private async Task<IActionResult> ValidateInput(string id, MapLayerData mapLayer)
        {
            if (id != mapLayer.Id)
            {
                return BadRequest("id must match mapLayer's id");
            }
            if (mapLayer.OsmUserId != User.Identity.Name)
            {
                return BadRequest("You can't manipulate a layer that is not yours...");
            }
            var validation = IsValidMapLayer(mapLayer);
            if (validation != string.Empty)
            {
                return BadRequest(validation);
            }
            var userLayers = await _repository.GetUserLayers(User.Identity.Name);
            if (userLayers.All(l => l.Id != mapLayer.Id))
            {
                return BadRequest("You can't manipulate a layer that is not yours...");
            }
            return null;
        }
    }
}
