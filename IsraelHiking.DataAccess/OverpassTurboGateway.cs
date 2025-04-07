using IsraelHiking.Common;
using IsraelHiking.DataAccessInterfaces;
using Microsoft.Extensions.Logging;
using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Net.Http;
using System.Text;
using System.Threading.Tasks;
using IsraelHiking.DataAccessInterfaces.Repositories;
using NetTopologySuite.Geometries;
using OsmSharp.Complete;
using OsmSharp.Streams;
using OsmSharp.Streams.Complete;

namespace IsraelHiking.DataAccess;

public class OverpassTurboGateway(
    IHttpClientFactory httpClientFactory,
    ILogger logger) : IOverpassTurboGateway, IHighwaysRepository
{
    private const string INTERPRETER_ADDRESS = "https://z.overpass-api.de/api/interpreter";
    private const string INTERPRETER_ADDRESS_2 = "https://lz4.overpass-api.de/api/interpreter";

    private async Task<string> GetQueryResponse(String queryString)
    {
        var client = httpClientFactory.CreateClient();
        var content = new StringContent(queryString);
        var response = await client.PostAsync(INTERPRETER_ADDRESS, content);
        if (!response.IsSuccessStatusCode)
        {
            response = await client.PostAsync(INTERPRETER_ADDRESS_2, content);
        }
        if (!response.IsSuccessStatusCode)
        {
            throw new Exception(await response.Content.ReadAsStringAsync());
        }
        return await response.Content.ReadAsStringAsync();
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
            var client = httpClientFactory.CreateClient();
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
            logger.LogError(ex, "Unable to get overpass data for language: " + languagePostfix);
        }
        return [];
    }
    
    public async Task<Dictionary<string,List<string>>> GetExternalReferences()
    {
        var dictionary = new Dictionary<string, List<string>>
        {
            { Sources.WIKIDATA, [] },
            { Sources.INATURE, [] }
        };
        try
        {
            var responseString = await GetQueryResponse("[out:csv('wikidata';false)];\nnwr['wikidata'](area:3606195356);\nout;");
            var wikidataLines = responseString.Split("\n", StringSplitOptions.RemoveEmptyEntries)
                .Select(s => s.Trim().TrimStart('"').TrimEnd('"').Replace("\"\"", "\"")).ToList(); // CSV " cleaning
            dictionary[Sources.WIKIDATA] = wikidataLines;
            responseString = await GetQueryResponse("[out:csv('ref:IL:inature';false)];\nnwr['ref:IL:inature'](area:3606195356);\nout;");
            var iNatureLines = responseString.Split("\n", StringSplitOptions.RemoveEmptyEntries)
                .Select(s => s.Trim().TrimStart('"').TrimEnd('"').Replace("\"\"", "\"")).ToList(); // CSV " cleaning
            dictionary[Sources.INATURE] = iNatureLines;
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Unable to get overpass data for external references");
        }
        return dictionary;
    }

    public async Task<List<CompleteWay>> GetHighways(Coordinate northEast, Coordinate southWest)
    {
        var response = await GetQueryResponse($"[out:xml];\nway[\"highway\"][!\"construction\"]({southWest.Y},{southWest.X},{northEast.Y},{northEast.X});\n(._;>;);\nout;");

        using MemoryStream memoryStream = new MemoryStream(Encoding.UTF8.GetBytes(response));
        var source = new XmlOsmStreamSource(memoryStream);
        var completeSource = new OsmSimpleCompleteStreamSource(source);

        return completeSource.OfType<CompleteWay>().ToList();
    }
}