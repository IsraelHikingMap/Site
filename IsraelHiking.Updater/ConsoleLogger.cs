using System;
using IsraelHiking.DataAccessInterfaces;

namespace IsraelHiking.Updater
{
    public class ConsoleLogger : ILogger
    {
        public void Debug(string message)
        {
            WriteToConsole("Debug:", message);
        }

        public void Error(string message)
        {
            WriteToConsole("Error:", message);
        }

        public void Info(string message)
        {
            WriteToConsole("Info :", message);
        }

        public void Warn(string message)
        {
            WriteToConsole("Warn :", message);
        }

        private void WriteToConsole(string level, string message)
        {
            Console.WriteLine(string.Join(" ", DateTime.Now.ToString("dd-MM-yyyy HH:mm:ss"), level, message));
        }
    }
}
