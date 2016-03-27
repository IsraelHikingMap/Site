using System.Threading.Tasks;

namespace IsraelHiking.DataAccessInterfaces
{
    public interface INssmHelper
    {
        Task Initialize(string serverPath);
        void Start();
        void Stop();
    }
}