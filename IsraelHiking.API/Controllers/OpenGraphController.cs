using System.Net.Http;
using System.Net.Http.Headers;
using System.Threading.Tasks;
using System.Web.Http;
using IsraelHiking.DataAccessInterfaces;

namespace IsraelHiking.API.Controllers
{
    public partial class OpenGraphHtmlTemplate
    {
        private string ThumbnailUrl { get; }

        public OpenGraphHtmlTemplate(string thumbnailUrl)
        {
            ThumbnailUrl = thumbnailUrl;
        }
    }

    public class OpenGraphController : ApiController
    {
        private readonly ILogger _logger;
        private readonly IIsraelHikingRepository _repository; 

        public OpenGraphController(IIsraelHikingRepository repository, 
            ILogger logger)
        {
            _repository = repository;
            _logger = logger;
        }

        public async Task<IHttpActionResult> GetHtml(string id)
        {
            _logger.Debug("Received a call to get html for: " + id);
            var url = await _repository.GetUrlById(id);
            var response = new HttpResponseMessage
            {
                Content = new StringContent(new OpenGraphHtmlTemplate(Url.Content("~/api/images/" + url.Id)).TransformText())
                //Content = new StringContent(new OpenGraphHtmlTemplate(Url.Content("http://israelhiking.osm.org.il/Tiles/12/2449/1652.png")).TransformText())
            };
            response.Content.Headers.ContentType = new MediaTypeHeaderValue("text/html");
            return ResponseMessage(response);
        }
    }
}
