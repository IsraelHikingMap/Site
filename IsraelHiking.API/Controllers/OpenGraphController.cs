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
        private string Title { get; }
        private string Description { get; }

        public OpenGraphHtmlTemplate(string thumbnailUrl, string title, string description)
        {
            ThumbnailUrl = thumbnailUrl;
            Title = string.IsNullOrWhiteSpace(title) ? "Israel Hiking Map Shared Route" : title;
            Description = string.IsNullOrWhiteSpace(description) ? "בין אם אתם יוצאים לטיול רגלי, רכיבה על אופניים או נסיעה ברכב שטח, כאן תוכלו למצוא כל מה שאתם צריכים על מנת לתכנן את הביקור הבא שלכם בטבע." : description;
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
                Content = new StringContent(new OpenGraphHtmlTemplate(Url.Content("~/api/images/" + url.Id), url.Title, url.Description).TransformText())
            };
            response.Content.Headers.ContentType = new MediaTypeHeaderValue("text/html");
            return ResponseMessage(response);
        }
    }
}
