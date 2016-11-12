namespace IsraelHiking.DataAccessInterfaces
{
    public interface IProcessHelper
    {
        void Start(string fileName, string arguments, string workingDirectory, int timeOutInMilliseconds = 10000);
    }
}