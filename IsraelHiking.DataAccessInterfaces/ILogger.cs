namespace IsraelHiking.DataAccessInterfaces
{
    public interface ILogger
    {
        void LogDebug(string message);
        void LogError(string message);
        void LogInformation(string message);
        void LogWarning(string message);
    }
}