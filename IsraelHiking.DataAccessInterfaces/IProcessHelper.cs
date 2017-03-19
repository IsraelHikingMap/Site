namespace IsraelHiking.DataAccessInterfaces
{
    public interface IProcessHelper
    {
        string StandardOutput { get; }
        void Start(string fileName, string arguments, string workingDirectory, int timeOutInMilliseconds = 10000);
    }
}