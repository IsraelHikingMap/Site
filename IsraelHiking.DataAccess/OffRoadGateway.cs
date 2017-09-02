using System;
using System.Collections.Generic;
using System.Net.Http;
using System.Text;
using System.Threading.Tasks;
using NetTopologySuite.Features;
using Newtonsoft.Json;

namespace IsraelHiking.DataAccess
{
    internal class OffroadJsonRequest
    {
        public bool offRoading { get; set; }
        public bool walking { get; set; }
        public bool cycling { get; set; }
    }

    public class OffRoadGateway : IOffRoadGateway
    {
        public async Task<List<Feature>> GetAll()
        {
            var address = "https://brilliant-will-93906.appspot.com/_ah/api/myAdventureApi/v1/getTracksByFilter?fields=items(mapItemList,track(activityType,backgroundServeUrl,created,description,difficultyLevel,duration,end,externalUrl,id,likes,ownerDisplayName,rating,reviews,sharingCode,start,title,trackLayerKey,userId,userMail))";
            using (var client = new HttpClient())
            {
                var requestBody = new OffroadJsonRequest
                {
                    cycling = true,
                    offRoading = true,
                    walking = true
                };
                var response = await client.PostAsync(address, new StringContent(JsonConvert.SerializeObject(requestBody)));
                string content = await response.Content.ReadAsStringAsync();
                return new List<Feature>();
            }

        }
    }
}
