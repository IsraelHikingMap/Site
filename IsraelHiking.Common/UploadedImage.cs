namespace IsraelHiking.Common;

/// <summary>
/// A picture of a point of interest after it was uploaded to an image host
/// </summary>
/// <param name="PictureId">The id of the picture in hosts that are referenced by an id, panoramax for example</param>
/// <param name="Url">The url of the picture in hosts that are referenced by a url, wikimedia commons for example</param>
/// <remarks>
/// Exactly one of the two is set, which is what decides whether the OSM entity references the picture
/// by an "image" tag holding a url or by a "panoramax" tag holding an id.
/// </remarks>
public record UploadedImage(string PictureId, string Url);
