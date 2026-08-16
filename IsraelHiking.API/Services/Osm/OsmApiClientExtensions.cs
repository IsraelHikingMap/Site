using Microsoft.Extensions.Logging;
using OsmSharp;
using OsmSharp.Complete;
using OsmSharp.IO.API;
using OsmSharp.Tags;
using System;
using System.Threading.Tasks;
using IsraelHiking.Common;

namespace IsraelHiking.API.Services.Osm;

/// <summary>
/// A helper class to OSM API Client
/// </summary>
public static class OsmApiClientExtensions
{
    /// <summary>
    /// Get an element by id and type
    /// </summary>
    /// <param name="client"></param>
    /// <param name="id"></param>
    /// <param name="osmGeoType"></param>
    /// <returns></returns>
    public static async Task<ICompleteOsmGeo> GetCompleteElement(this INonAuthClient client, long id, OsmGeoType osmGeoType)
    {
        switch (osmGeoType)
        {
            case OsmGeoType.Node:
                return await client.GetNode(id);
            case OsmGeoType.Way:
                return await client.GetCompleteWay(id);
            case OsmGeoType.Relation:
                return await client.GetCompleteRelation(id);
            default:
                throw new Exception("Invalid type: " + osmGeoType);
        }
    }

    /// <summary>
    /// Creates OSM changeset
    /// </summary>
    /// <param name="client"></param>
    /// <param name="comment"></param>
    /// <param name="clientDetails">The details of the client that requested the change</param>
    /// <returns></returns>
    public static Task<long> CreateChangeset(this IAuthClient client, string comment, ClientDetails clientDetails)
    {
        return client.CreateChangeset(new TagsCollection
        {
            new Tag {Key = "created_by", Value = CreateCreatedByValue(clientDetails)},
            new Tag {Key = "comment", Value = comment}
        });
    }

    /// <summary>
    /// Builds the "created_by" changeset tag - the server version, and the client details when the client reported any,
    /// i.e. "Mapeak 9.21.3 (web)", "Mapeak 9.21.3 (app 9.21.2)" or "Mapeak 9.21.3" for a client that predates this
    /// </summary>
    /// <param name="clientDetails">The details of the client that requested the change</param>
    /// <returns>The value of the "created_by" tag</returns>
    private static string CreateCreatedByValue(ClientDetails clientDetails)
    {
        var osmInfo = clientDetails?.OsmInfo;
        return string.IsNullOrEmpty(osmInfo)
            ? $"{Branding.SITE_NAME} {Branding.VERSION}"
            : $"{Branding.SITE_NAME} {Branding.VERSION} ({osmInfo})";
    }

    /// <summary>
    /// Uploads to OSM with reties utility method
    /// </summary>
    /// <param name="osmGateway">The gateway</param>
    /// <param name="message">The change set message</param>
    /// <param name="clientDetails">The details of the client that requested the change</param>
    /// <param name="createOrUpdate">The action to take between open and close of the change set</param>
    /// <param name="logger">A logger</param>
    public static async Task UploadToOsmWithRetries(this IAuthClient osmGateway, string message, ClientDetails clientDetails, Func<long, Task> createOrUpdate, ILogger logger)
    {
        long changeSetId = -1;
        for (var retryIndex = 0; retryIndex < 3; retryIndex++)
        {
            try
            {
                if (changeSetId == -1)
                {
                    changeSetId = await osmGateway.CreateChangeset(message, clientDetails);
                }
                await createOrUpdate(changeSetId);
                await osmGateway.CloseChangeset(changeSetId);
                return;
            }
            catch (Exception ex)
            {
                logger.LogError(ex, $"Failed to upload data to OSM, retry: {retryIndex}, message: {message}");
                await Task.Delay(200);
            }
        }
    }
}