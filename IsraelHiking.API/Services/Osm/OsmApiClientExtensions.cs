using Microsoft.Extensions.Logging;
using OsmSharp;
using OsmSharp.Complete;
using OsmSharp.IO.API;
using OsmSharp.Tags;
using System;
using System.Collections.Generic;
using System.Linq;
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
                return await client.GetCompleteRelationRecursive(id, []);
            default:
                throw new Exception("Invalid type: " + osmGeoType);
        }
    }

    /// <summary>
    /// The "full" response of a relation does not contain the members of its child relations,
    /// so a super relation, i.e. a relation whose members are relations, comes back without any way in it.
    /// This fetches the child relations recursively in order to get the full geometry of the relation.
    /// </summary>
    /// <param name="client"></param>
    /// <param name="id"></param>
    /// <param name="fetchedIds">The ids that were already fetched, to avoid an endless loop in case of a cyclic relation</param>
    /// <returns></returns>
    private static async Task<CompleteRelation> GetCompleteRelationRecursive(this INonAuthClient client, long id, HashSet<long> fetchedIds)
    {
        if (!fetchedIds.Add(id))
        {
            return null;
        }
        var relation = await client.GetCompleteRelation(id);
        if (relation == null)
        {
            return null;
        }
        foreach (var member in relation.Members.Where(m => m.Member is CompleteRelation))
        {
            member.Member = await client.GetCompleteRelationRecursive(member.Member.Id, fetchedIds) ?? member.Member;
        }
        return relation;
    }

    /// <summary>
    /// Creates OSM changeset
    /// </summary>
    /// <param name="client"></param>
    /// <param name="comment"></param>
    /// <returns></returns>
    public static Task<long> CreateChangeset(this IAuthClient client, string comment)
    {
        return client.CreateChangeset(new TagsCollection
        {
            new Tag {Key = "created_by", Value = $"{Branding.SITE_NAME} {Branding.VERSION}"},
            new Tag {Key = "comment", Value = comment}
        });
    }

    /// <summary>
    /// Uploads to OSM with reties utility method
    /// </summary>
    /// <param name="osmGateway">The gateway</param>
    /// <param name="message">The change set message</param>
    /// <param name="createOrUpdate">The action to take between open and close of the change set</param>
    /// <param name="logger">A logger</param>
    public static async Task UploadToOsmWithRetries(this IAuthClient osmGateway, string message, Func<long, Task> createOrUpdate, ILogger logger)
    {
        long changeSetId = -1;
        for (var retryIndex = 0; retryIndex < 3; retryIndex++)
        {
            try
            {
                if (changeSetId == -1)
                {
                    changeSetId = await osmGateway.CreateChangeset(message);    
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
        logger.LogError($"Giving up on uploading data to OSM, changeset: {changeSetId}, message: {message}");
    }
}