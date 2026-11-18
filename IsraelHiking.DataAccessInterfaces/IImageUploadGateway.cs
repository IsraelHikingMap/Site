using NetTopologySuite.Geometries;
using System.IO;
using System.Threading.Tasks;

namespace IsraelHiking.DataAccessInterfaces;

/// <summary>
/// Uploads the pictures of points of interest to the public image host of this site
/// </summary>
public interface IImageUploadGateway
{
    /// <summary>
    /// Uploads a picture and returns the url the OSM entity should hold for it
    /// </summary>
    /// <param name="fileName">The name of the file to upload</param>
    /// <param name="description">The description of the point of interest the picture belongs to</param>
    /// <param name="author">The OSM user name of whoever took the picture</param>
    /// <param name="contentStream">The picture itself</param>
    /// <param name="location">The location of the point of interest the picture belongs to</param>
    /// <returns>The url of the uploaded picture</returns>
    Task<string> UploadImage(string fileName, string description, string author, Stream contentStream, Coordinate location);
}
