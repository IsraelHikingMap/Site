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
using IsraelHiking.Common.Configuration;
using Microsoft.Extensions.Options;
using NetTopologySuite.Geometries;
using OsmSharp;
using OsmSharp.Complete;
using OsmSharp.Db.Impl;
using OsmSharp.Streams;
using System.Text.Json.Nodes;

namespace IsraelHiking.DataAccess;

public class OverpassTurboGateway(
    IHttpClientFactory httpClientFactory,
    IOptions<ConfigurationData> configurationData,
    ILogger logger) : IOverpassTurboGateway
{
    private async Task<string> GetQueryResponse(string queryString)
    {
        var client = httpClientFactory.CreateClient();
        var content = new StringContent(queryString);
        HttpResponseMessage response = null;
        foreach (var address in configurationData.Value.OverpassAddresses)
        {
            for (int iRetry = 0; iRetry < 3; iRetry++)
            {
                try
                {
                    response = await client.PostAsync(address, content);
                    if (response.IsSuccessStatusCode)
                    {
                        return await response.Content.ReadAsStringAsync();
                    }
                    else
                    {
                        await Task.Delay(1000);
                    }
                }
                catch
                {
                    await Task.Delay(1000);
                }
            }
        }
        if (response is { IsSuccessStatusCode: false })
        {
            throw new Exception($"Problem with overpass query: {queryString}\n\n Error after 3 retries: {await response.Content.ReadAsStringAsync()}");
        }
        throw new Exception("No overpass addresses provided");
    }

    public async Task<Dictionary<string, List<string>>> GetExternalReferences()
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
        var query = $"[out:xml];\nway[\"highway\"][!\"construction\"]({southWest.Y},{southWest.X},{northEast.Y},{northEast.X});\nout meta;\n>;\nout;";
        var response = await GetQueryResponse(query);

        using MemoryStream memoryStream = new MemoryStream(Encoding.UTF8.GetBytes(response));
        var source = new XmlOsmStreamSource(memoryStream);

        var db = new MemorySnapshotDb().CreateSnapshotDb();
        var list = source.ToList();
        db.AddOrUpdate(list);
        return list.OfType<Way>().Select(w => w.CreateComplete(db)).ToList();
    }

    public async Task<List<string>> GetImagesUrls()
    {
        var responseString = await GetQueryResponse("[out:csv('image';false)];\nnwr[~\"^image\"~\".\"](area:3606195356);\nout;");
        var images = responseString.Split("\n", StringSplitOptions.RemoveEmptyEntries)
            .Select(s => s.Trim().TrimStart('"').TrimEnd('"').Replace("\"\"", "\"")).ToList(); // CSV " cleaning
        return images;
    }

    public async Task<long> GetClosestBarrierId(Coordinate center, double distance)
    {
        var query = $"[out:json];\nnode[\"barrier\"](around:{distance}, {center.Y}, {center.X});\nout ids 1;";
        var response = await GetQueryResponse(query);
        var jsonNode = JsonNode.Parse(response);
        var elements = jsonNode["elements"].AsArray();
        if (elements.Count <= 0)
        {
            return -1;
        }
        return (long)elements[0]["id"];
    }

}
