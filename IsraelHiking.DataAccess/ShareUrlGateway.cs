using System.Net.Http;
using System.Text.Json;
using System.Threading.Tasks;
using IsraelHiking.Common;
using IsraelHiking.Common.Configuration;
using IsraelHiking.DataAccessInterfaces;
using Microsoft.Extensions.Options;

namespace IsraelHiking.DataAccess;

public class ShareUrlGateway(IHttpClientFactory httpClientFactory, IOptions<ConfigurationData> options)
    : IShareUrlGateway
{
    private readonly ConfigurationData _options = options.Value;

    public async Task<ShareUrl> GetUrlById(string id)
    {
        var client = httpClientFactory.CreateClient();
        var response = await client.GetAsync(_options.ShareUrlApiAddress + id);
        var content = await response.Content.ReadAsStringAsync();
        var shareUrl = JsonSerializer.Deserialize<ShareUrl>(content);
        return shareUrl;
    }
}