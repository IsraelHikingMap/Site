using System;
using System.Linq;
using System.Net.Http;
using System.Net.Http.Json;
using System.Threading.Tasks;
using IsraelHiking.Common.Configuration;
using IsraelHiking.Common.DataContainer;
using IsraelHiking.DataAccessInterfaces;
using Microsoft.Extensions.Options;
using Newtonsoft.Json;

namespace IsraelHiking.DataAccess;

class TileServerImageCreatorBody
{
    [JsonProperty("path")]
    public string Path { get; set; }
}

public class ImageCreationGateway(IHttpClientFactory httpClientFactory, IOptions<ConfigurationData> options) : IImageCreationGateway
{
    private readonly IHttpClientFactory _httpClientFactory = httpClientFactory;
    private readonly string _serverAddress = options.Value.ImageCreatorServerAddress;

    public async Task<byte[]> Create(DataContainerPoco dataContainer, int width, int height)
    {
        var client = _httpClientFactory.CreateClient();
        var queryParameters = $"styles/mapeak-hike/static/auto/{width}x{height}.jpg?border=white";
        var allPointsString = string.Join("|", dataContainer.Routes.SelectMany(r => r.Segments.SelectMany(s => s.Latlngs)).Select(l => $"{l.Lng},{l.Lat}"));
        var body = new TileServerImageCreatorBody
        {
            Path = "stroke:blue|width:5|" + allPointsString
        };

        Console.WriteLine(body.Path);
        var response = await client.PostAsync(_serverAddress + queryParameters, JsonContent.Create(body));
        return await response.Content.ReadAsByteArrayAsync();
    }
}