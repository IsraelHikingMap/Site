using IsraelHiking.DataAccessInterfaces;
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
    IOptions<ConfigurationData> configurationData) : IOverpassTurboGateway
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
