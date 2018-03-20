using System;
using System.Diagnostics;
using System.Linq;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Logging.Internal;

namespace IsraelHiking.DataAccess.Tests
{
    internal class TraceLogger : ILogger
    {
        public IDisposable BeginScope<TState>(TState state)
        {
            return null;
        }

        public bool IsEnabled(LogLevel logLevel)
        {
            return true;
        }

        public void Log<TState>(LogLevel logLevel, EventId eventId, TState state, Exception exception, Func<TState, Exception, string> formatter)
        {
            var format = state as FormattedLogValues;
            Trace.WriteLine(format.First().Value);
        }

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