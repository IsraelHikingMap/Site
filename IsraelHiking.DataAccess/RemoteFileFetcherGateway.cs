using IsraelHiking.DataAccessInterfaces;
using System.Threading.Tasks;
using Microsoft.Extensions.Logging;
using System.IO;
using System.Net.Http;
using System;
using IsraelHiking.Common;
using IsraelHiking.Common.Api;

namespace IsraelHiking.DataAccess;

public class RemoteFileFetcherGateway : IRemoteFileFetcherGateway
{
    private readonly IHttpClientFactory _httpClientFactory;
    private readonly ILogger _logger;

    public RemoteFileFetcherGateway(IHttpClientFactory httpClientFactory, ILogger logger)
    {
        _httpClientFactory = httpClientFactory;
        _logger = logger;
    }

    public async Task<RemoteFileFetcherGatewayResponse> GetFileContent(string url)
    {
        var client = _httpClientFactory.CreateClient();
        client.Timeout = TimeSpan.FromMinutes(20);
        client.DefaultRequestHeaders.UserAgent.ParseAdd(Branding.USER_AGENT);
        var response = await client.GetAsync(url);
        var fileName = response.Content.Headers.ContentDisposition?.FileName?.Trim('"') ??
                       response.Content.Headers.ContentDisposition?.FileNameStar?.Trim('"') ??
                       url.Substring(url.LastIndexOf("/", StringComparison.Ordinal) + 1);
        var content = Array.Empty<byte>();
        if (response.IsSuccessStatusCode)
        {
            content = await response.Content.ReadAsByteArrayAsync();
        }
        else
        {
            _logger.LogError("Unable to retrieve file from: " + url + ", Status code: " + response.StatusCode);
        }

        return new RemoteFileFetcherGatewayResponse
        {
            Content = content,
            FileName = fileName
        };
    }

    public Task<(Stream Content, long? Length)> GetFileStream(string url)
    {
        return SendForFileStream(new HttpRequestMessage(HttpMethod.Get, url));
    }

    public Task<(Stream Content, long? Length)> PostForFileStream(string url, string content)
    {
        return SendForFileStream(new HttpRequestMessage(HttpMethod.Post, url) { Content = new StringContent(content) });
    }

    /// <summary>
    /// Reads only the headers of the response, so that its body is streamed to the client rather than buffered in memory.
    /// </summary>
    private async Task<(Stream Content, long? Length)> SendForFileStream(HttpRequestMessage request)
    {
        var client = _httpClientFactory.CreateClient();
        client.Timeout = TimeSpan.FromMinutes(20);
        client.DefaultRequestHeaders.UserAgent.ParseAdd(Branding.USER_AGENT);
        var response = await client.SendAsync(request, HttpCompletionOption.ResponseHeadersRead);
        response.EnsureSuccessStatusCode();
        var length = response.Content.Headers.ContentLength;
        return (await response.Content.ReadAsStreamAsync(), length);
    }
}