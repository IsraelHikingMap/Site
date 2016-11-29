using IsraelHiking.Common;
using IsraelHiking.DataAccessInterfaces;

namespace IsraelHiking.DataAccess.Osm
{
    public class HttpGatewayFactory : IHttpGatewayFactory
    {
        private readonly ILogger _logger;
        public HttpGatewayFactory(ILogger logger)
        {
            _logger = logger;
        }

        public IRemoteFileFetcherGateway CreateRemoteFileFetcherGateway(TokenAndSecret tokenAndSecret)
        {
            if (tokenAndSecret == null)
            {
                return new RemoteFileFetcherGateway(_logger);
            }
            return new OsmGateway(tokenAndSecret, _logger);
        }

        public IOsmGateway CreateOsmGateway(TokenAndSecret tokenAndSecret)
        {
            return new OsmGateway(tokenAndSecret, _logger);
        }
    }
}
