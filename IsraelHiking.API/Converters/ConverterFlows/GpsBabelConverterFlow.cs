using IsraelHiking.DataAccessInterfaces;

namespace IsraelHiking.API.Converters.ConverterFlows
{
    public class GpsBabelConverterFlow : IConverterFlowItem
    {
        private readonly IGpsBabelGateway _gpsBabelGateway;
        public string Input { get; }
        public string Output { get; }

        public GpsBabelConverterFlow(IGpsBabelGateway gpsBabelGateway, string input, string output)
        {
            _gpsBabelGateway = gpsBabelGateway;
            Input = input;
            Output = output;
        }

        public byte[] Transform(byte[] content)
        {
            return _gpsBabelGateway.ConvertFileFromat(content, Input, Output).Result;
        }
    }
}