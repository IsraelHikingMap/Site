using IsraelHiking.Common;
using IsraelHiking.DataAccessInterfaces;

namespace IsraelHiking.DataAccess.Osm
{
    public class HttpGatewayFactory : IHttpGatewayFactory
    {
        private readonly ILogger _logger;
        private readonly IOptions<ConfigurationData> _options;
        public HttpGatewayFactory(IOptions<ConfigurationData> options, ILogger logger)
        {
            _options = options;
            _logger = logger;
        }

        public IRemoteFileFetcherGateway CreateRemoteFileFetcherGateway(TokenAndSecret tokenAndSecret)
        {
            if (tokenAndSecret == null)
            {
                return new RemoteFileFetcherGateway(_logger);
            }
            return new OsmGateway(tokenAndSecret, _options, _logger);
        }

        public IOsmGateway CreateOsmGateway(TokenAndSecret tokenAndSecret)
        {
            return new OsmGateway(tokenAndSecret, _options, _logger);
        }
    }
}
