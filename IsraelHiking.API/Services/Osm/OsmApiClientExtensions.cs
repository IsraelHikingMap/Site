using OsmSharp;
using OsmSharp.Complete;
using OsmSharp.IO.API;
using OsmSharp.Tags;
using System;
using System.Threading.Tasks;

namespace IsraelHiking.API.Services.Osm
{
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
        /// Creates IHM changeset
        /// </summary>
        /// <param name="client"></param>
        /// <param name="comment"></param>
        /// <returns></returns>
        public static Task<long> CreateChangeset(this IAuthClient client, string comment)
        {
            return client.CreateChangeset(new TagsCollection
                            {
                                new Tag {Key = "created_by", Value = "IsraelHiking.osm.org.il"},
                                new Tag {Key = "comment", Value = comment}
                            });
        }
    }
}
