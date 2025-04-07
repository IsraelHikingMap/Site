﻿using IsraelHiking.Common;
using IsraelHiking.DataAccessInterfaces;
using Microsoft.Extensions.Logging;
using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Net.Http;
using System.Text;
using System.Threading.Tasks;
using IsraelHiking.Common.Configuration;
using Microsoft.Extensions.Options;
using NetTopologySuite.Geometries;
using OsmSharp.Complete;
using OsmSharp.Streams;
using OsmSharp.Streams.Complete;

namespace IsraelHiking.DataAccess;

public class OverpassTurboGateway(
    IHttpClientFactory httpClientFactory,
    IOptions<ConfigurationData> configurationData,
    ILogger logger) : IOverpassTurboGateway
{
    private async Task<string> GetQueryResponse(String queryString)
    {
        var client = httpClientFactory.CreateClient();
        var content = new StringContent(queryString);
        HttpResponseMessage response = null;
        foreach (var address in configurationData.Value.OverpassAddresses)
        {
            response = await client.PostAsync(address, content);
            if (response.IsSuccessStatusCode)
            {
                return await response.Content.ReadAsStringAsync();
            }
        }
        if (response is { IsSuccessStatusCode: false })
        {
            throw new Exception(await response.Content.ReadAsStringAsync());
        }
        throw new Exception("No overpass addresses provided");
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

    public async Task<List<string>> GetImagesUrls()
    {
        var responseString = await GetQueryResponse("[out:csv('image';false)];\nnwr[~\"^image\"~\".\"](area:3606195356);\nout;");
        var images = responseString.Split("\n", StringSplitOptions.RemoveEmptyEntries)
            .Select(s => s.Trim().TrimStart('"').TrimEnd('"').Replace("\"\"", "\"")).ToList(); // CSV " cleaning
        return images;
    }
        
}