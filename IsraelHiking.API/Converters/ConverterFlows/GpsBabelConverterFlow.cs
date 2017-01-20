using IsraelHiking.DataAccessInterfaces;

namespace IsraelHiking.API.Converters.ConverterFlows
{
    ///<inheritdoc />
    public class GpsBabelConverterFlow : IConverterFlowItem
    {
        private readonly IGpsBabelGateway _gpsBabelGateway;
        ///<inheritdoc />
        public string Input { get; }
        ///<inheritdoc />
        public string Output { get; }

        /// <summary>
        /// Constructor
        /// </summary>
        /// <param name="gpsBabelGateway"></param>
        /// <param name="input"></param>
        /// <param name="output"></param>
        public GpsBabelConverterFlow(IGpsBabelGateway gpsBabelGateway, string input, string output)
        {
            _gpsBabelGateway = gpsBabelGateway;
            Input = input;
            Output = output;
        }

        ///<inheritdoc />
        public byte[] Transform(byte[] content)
        {
            return _gpsBabelGateway.ConvertFileFromat(content, Input, Output).Result;
        }
    }
}