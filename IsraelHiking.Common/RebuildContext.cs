using IsraelHiking.Common.Api;
using System;

namespace IsraelHiking.Common
{
    public class RebuildContext
    {
        public UpdateRequest Request { get; set; }
        public DateTime StartTime { get; set; }
        public bool Succeeded { get; set; }
        public string ErrorMessage { get; set; }
    }
}
