namespace IsraelHiking.DataAccessInterfaces
{
    public interface ILogger
    {
        void Debug(string message);
        void Error(string message);
        void Info(string message);
        void Warn(string message);
    }
}