using System.Threading.Tasks;

namespace IsraelHiking.DataAccessInterfaces;

/// <summary>
/// Keeps track of the devices a subscribed user uses the subscription from, so that an account that is
/// shared between people can be told apart from one that is used from a phone, a tablet and a browser
/// </summary>
public interface IUserDevicesGateway
{
    /// <summary>
    /// Reports that the user of the current request was seen using the subscription from the given device, now
    /// </summary>
    /// <remarks>A failure to report it is logged and swallowed - this is bookkeeping that must never
    /// fail the request it was reported by.</remarks>
    /// <param name="deviceId">The device as the client reported it, see the client details headers</param>
    /// <param name="platform">The client's platform, i.e. web, android or ios</param>
    /// <param name="appVersion">The app version, null for a browser</param>
    Task UpdateUserDevice(string deviceId, string platform, string appVersion);
}
