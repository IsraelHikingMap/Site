using System.Collections.Generic;
using IsraelHiking.Common;

namespace IsraelHiking.DataAccessInterfaces
{
    public interface IOptions<T>
    {
        T Value { get; }
    }
}