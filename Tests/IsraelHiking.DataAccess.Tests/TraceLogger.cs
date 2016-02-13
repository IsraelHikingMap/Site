using System.Diagnostics;
using IsraelHiking.DataAccessInterfaces;

namespace IsraelHiking.DataAccess.Tests
{
    internal class TraceLogger : ILogger
    {
        public void Debug(string message)
        {
            Trace.WriteLine(message);
        }

        public void Error(string message)
        {
            Trace.WriteLine(message);
        }

        public void Info(string message)
        {
            Trace.WriteLine(message);
        }

        public void Warn(string message)
        {
            Trace.WriteLine(message);
        }
    }
}