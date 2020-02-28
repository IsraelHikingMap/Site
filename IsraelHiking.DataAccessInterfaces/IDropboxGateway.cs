using IsraelHiking.Common;
using System;
using System.Collections.Generic;
using System.Threading.Tasks;

namespace IsraelHiking.DataAccessInterfaces
{
    public interface IDropboxGateway
    {
        Task<RemoteFileFetcherGatewayResponse> GetFileContent(string fileName);
        Task<List<string>> GetUpdatedFilesList(DateTime lastModifiedDate);
        void Initialize();
    }
}