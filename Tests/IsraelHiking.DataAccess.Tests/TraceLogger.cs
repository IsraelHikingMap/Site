using System.Diagnostics;
using IsraelHiking.DataAccessInterfaces;

namespace IsraelHiking.DataAccess.Tests
{
    internal class TraceLogger : ILogger
    {
        public void LogDebug(string message)
        {
            Trace.WriteLine(message);
        }

        public void LogError(string message)
        {
            Trace.WriteLine(message);
        }

        public void LogInformation(string message)
        {
            Trace.WriteLine(message);
        }

        public void LogWarning(string message)
        {
            Trace.WriteLine(message);
        }
    }
}