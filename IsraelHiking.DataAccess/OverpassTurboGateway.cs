using IsraelHiking.Common;
using IsraelHiking.DataAccessInterfaces;
using Microsoft.Extensions.Logging;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Net.Http;
using System.Threading.Tasks;

namespace IsraelHiking.DataAccess;

public class OverpassTurboGateway : IOverpassTurboGateway
{
    private const string INTERPRETER_ADDRESS = "https://z.overpass-api.de/api/interpreter";
    private const string INTERPRETER_ADDRESS_2 = "https://lz4.overpass-api.de/api/interpreter";
    private readonly IHttpClientFactory _httpClientFactory;
    private readonly ILogger _logger;

    public OverpassTurboGateway(IHttpClientFactory httpClientFactory,
        ILogger logger)
    {
        _httpClientFactory = httpClientFactory;
        _logger = logger;
    }

    public async Task<List<string>> GetWikipediaLinkedTitles()
    {
        var list = await GetWikipediaLinkedTitlesByLanguage(string.Empty);
        foreach (var language in Languages.Array)
        {
            var perLanguage = await GetWikipediaLinkedTitlesByLanguage(":" + language);
            list.AddRange(perLanguage.Select(w => language + ":" + w).ToList());
        }
        return list.Distinct().ToList();
    }

    private async Task<List<string>> GetWikipediaLinkedTitlesByLanguage(string languagePostfix)
    {
        try
        {
            var client = _httpClientFactory.CreateClient();
            var queryString = "[out:csv('wikipedia';false)];\nnwr  ['wikipedia'] (area:3606195356);\nout; ";
            var postBody = new StringContent(queryString.Replace("'wikipedia'", $"'wikipedia{languagePostfix}'"));
            var response = await client.PostAsync(INTERPRETER_ADDRESS, postBody);
            if (!response.IsSuccessStatusCode)
            {
                response = await client.PostAsync(INTERPRETER_ADDRESS_2, postBody);
            }
            if (!response.IsSuccessStatusCode)
            {
                throw new Exception(await response.Content.ReadAsStringAsync());
            }
            var responseString = await response.Content.ReadAsStringAsync();
            return responseString.Split("\n", StringSplitOptions.RemoveEmptyEntries)
                .Select(s => s.Trim().TrimStart('"').TrimEnd('"').Replace("\"\"", "\"")).ToList(); // CSV " cleaning
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Unable to get overpass data for language: " + languagePostfix);
        }
        return [];
    }
}