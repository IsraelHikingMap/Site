using IsraelHiking.DataAccessInterfaces;
using NetTopologySuite.Geometries;

using System.Linq;
using System.Net.Http;
using System.Net.Http.Json;
using System.Threading.Tasks;
using IsraelHiking.Common.Configuration;
using Microsoft.Extensions.Options;

namespace IsraelHiking.DataAccess
{
    public class ElevationGateway : IElevationGateway
    {
        private readonly IHttpClientFactory _httpClientFactory;

        private readonly ConfigurationData _options;
        public ElevationGateway(IOptions<ConfigurationData> options, 
            IHttpClientFactory httpClientFactory)
        {
            _options = options.Value;
            _httpClientFactory = httpClientFactory;
        }
        
        /// <summary>
        /// Get the elvation from the elevation provider using http
        /// </summary>
        /// <param name="latLng">The point to calculate elevation for</param>
        /// <returns>A task with the elevation results</returns>
        public async Task<double> GetElevation(Coordinate latLng)
        {
            var client = _httpClientFactory.CreateClient();
            var response = await client.GetAsync($"${_options.ElevationServerAddress}?points={latLng.X}%2C{latLng.Y}");
            if (!response.IsSuccessStatusCode)
            {
                return 0;
            }
            var json = await response.Content.ReadFromJsonAsync<double[]>();
            return json?.FirstOrDefault() ?? 0;

        }

        public async Task<double[]> GetElevation(Coordinate[] latLngs)
        {
            var client = _httpClientFactory.CreateClient();
            var arrays = latLngs.Select(l => new[] {l.X, l.Y}).ToArray();
            var response = await client.PostAsync(_options.ElevationServerAddress, JsonContent.Create(arrays));
            if (!response.IsSuccessStatusCode)
            {
                return Enumerable.Repeat(0.0, arrays.Length).ToArray();
            }
            var json = await response.Content.ReadFromJsonAsync<double[]>();
            return json ?? Enumerable.Repeat(0.0, arrays.Length).ToArray();
        }
    }
}
