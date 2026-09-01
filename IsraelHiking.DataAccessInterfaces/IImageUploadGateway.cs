using IsraelHiking.Common;
using NetTopologySuite.Geometries;
using System.IO;
using System.Threading.Tasks;

namespace IsraelHiking.DataAccessInterfaces;

/// <summary>
/// Uploads the pictures of points of interest to the public image host of this site
/// </summary>
/// <remarks>
/// There is one implementation per host - wikimedia commons and panoramax - and the host the site uploads to
/// is decided by which of them is registered in RegisterDataAccess.
/// </remarks>
public interface IImageUploadGateway
{
    /// <summary>
    /// Uploads a picture and returns the reference the OSM entity should hold for it
    /// </summary>
    /// <param name="fileName">The name of the file to upload</param>
    /// <param name="description">The description of the point of interest the picture belongs to</param>
    /// <param name="author">The OSM user name of whoever took the picture</param>
    /// <param name="contentStream">The picture itself</param>
    /// <param name="location">The location of the point of interest the picture belongs to</param>
    /// <returns>The uploaded picture, referenced by an id or by a url depending on the host</returns>
    Task<UploadedImage> UploadImage(string fileName, string description, string author, Stream contentStream, Coordinate location);
}
