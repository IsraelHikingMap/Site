using System.Threading.Tasks;

namespace IsraelHiking.DataAccessInterfaces
{
    public interface IGraphHopperHelper : INssmHelper
    {
        Task UpdateData(string osmFileFullPath);
    }
}