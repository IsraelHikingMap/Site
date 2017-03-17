using System;
using System.Diagnostics;
using Microsoft.Extensions.Logging;

namespace IsraelHiking.DataAccess.Tests
{
    internal class TraceLogger : ILogger
    {
        public IDisposable BeginScope<TState>(TState state)
        {
            //throw new NotImplementedException();
            return null;
        }

        public bool IsEnabled(LogLevel logLevel)
        {
            return true;
        }

        public void Log<TState>(LogLevel logLevel, EventId eventId, TState state, Exception exception, Func<TState, Exception, string> formatter)
        {
            //throw new NotImplementedException();
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