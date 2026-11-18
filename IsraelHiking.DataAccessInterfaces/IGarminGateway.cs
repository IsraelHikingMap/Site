using System.Collections.Generic;
using System.Net.Http;
using System.Threading.Tasks;

namespace IsraelHiking.DataAccessInterfaces;

/// <summary>
/// Makes the Garmin Connect token requests, which need this server's client secret.
/// </summary>
/// <remarks>
/// Garmin issues no secretless client, so unlike Wahoo the token requests can not be made from the user's device.
/// The rest of the Garmin API is reached through the nginx pass-through, as Wahoo's is.
/// </remarks>
public interface IGarminGateway
{
    /// <summary>
    /// Sends a standard OAuth token request - an authorization code exchange or a refresh - with the client credentials added
    /// </summary>
    /// <param name="parameters">The form parameters of the token request</param>
    Task<HttpResponseMessage> RequestToken(IEnumerable<KeyValuePair<string, string>> parameters);
}
