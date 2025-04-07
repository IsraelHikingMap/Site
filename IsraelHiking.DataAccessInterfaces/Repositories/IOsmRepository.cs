using System.Collections.Generic;
using System.Threading.Tasks;
using OsmSharp.Complete;
using System.IO;

namespace IsraelHiking.DataAccessInterfaces.Repositories;

public interface IOsmRepository
{
    Task<List<string>> GetImagesUrls(Stream osmFileStream);
}