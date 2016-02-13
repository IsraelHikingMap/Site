using System.Threading.Tasks;

namespace IsraelHiking.DataAccessInterfaces
{
    public interface IGraphHopperHelper
    {
        string WorkingDirectory { get; }
        Task Initialize(string serverPath);
        Task UpdateData();
    }
}