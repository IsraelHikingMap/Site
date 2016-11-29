using IsraelHiking.Common;

namespace IsraelHiking.DataAccessInterfaces
{
    public interface IHttpGatewayFactory
    {
        IOsmGateway CreateOsmGateway(TokenAndSecret tokenAndSecret);
        IRemoteFileFetcherGateway CreateRemoteFileFetcherGateway(TokenAndSecret tokenAndSecret);
    }
}