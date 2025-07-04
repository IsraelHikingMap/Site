using IsraelHiking.Common.DataContainer;
using System.Text.Json.Serialization;
using System;
using IsraelHiking.Common.Extensions;

namespace IsraelHiking.Common;

public class ShareUrl
{
    [JsonPropertyName("id")]
    public string Id { get; set; }
    [JsonPropertyName("title")]
    public string Title { get; set; }
    [JsonPropertyName("description")]
    public string Description { get; set; }
    [JsonPropertyName("osmUserId")]
    [JsonConverter(typeof(AutoNumberToStringConverter))]
    public string OsmUserId { get; set; }
    [JsonPropertyName("viewsCount")]
    public int ViewsCount { get; set; }
    [JsonPropertyName("creationDate")]
    public DateTime CreationDate { get; set; }
    [JsonPropertyName("lastModifiedDate")]
    public DateTime LastModifiedDate { get; set; }
    [JsonPropertyName("lastViewed")]
    public DateTime LastViewed { get; set; }

    [JsonPropertyName("dataContainer")]
    public DataContainerPoco DataContainer { get; set; }
    [JsonPropertyName("base64Preview")]
    public string Base64Preview { get; set; }
}

public static class ShareUrlExtensions
{
    public static void FixModifiedDate(this ShareUrl shareUrl)
    {
        if (shareUrl.LastModifiedDate < shareUrl.CreationDate)
        {
            shareUrl.LastModifiedDate = shareUrl.CreationDate;
        }
    }
}