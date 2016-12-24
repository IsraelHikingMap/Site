using IsraelHiking.Common;
using IsraelHiking.DataAccessInterfaces;

namespace IsraelHiking.DataAccess.Osm
{
    public class HttpGatewayFactory : IHttpGatewayFactory
    {
        private readonly IConfigurationProvider _configurationProvider;
        private readonly ILogger _logger;
        public HttpGatewayFactory(IConfigurationProvider configurationProvider, ILogger logger)
        {
            _configurationProvider = configurationProvider;
            _logger = logger;
        }

        public IRemoteFileFetcherGateway CreateRemoteFileFetcherGateway(TokenAndSecret tokenAndSecret)
        {
            if (tokenAndSecret == null)
            {
                return new RemoteFileFetcherGateway(_logger);
            }
            return new OsmGateway(tokenAndSecret, _configurationProvider, _logger);
        }

        public IOsmGateway CreateOsmGateway(TokenAndSecret tokenAndSecret)
        {
            return new OsmGateway(tokenAndSecret, _configurationProvider, _logger);
        }
    }
}
