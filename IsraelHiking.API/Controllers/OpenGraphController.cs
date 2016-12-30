using System.Net;
using System.Net.Http;
using System.Net.Http.Headers;
using System.Threading.Tasks;
using System.Web.Http;
using IsraelHiking.DataAccessInterfaces;

namespace IsraelHiking.API.Controllers
{
    /// <summary>
    /// This class can be used to create the HTML facebook crawlable page
    /// </summary>
    public partial class OpenGraphHtmlTemplate
    {
        private string ThumbnailUrl { get; }
        private string Title { get; }
        private string Description { get; }

        public OpenGraphHtmlTemplate(string thumbnailUrl, string title, string description)
        {
            ThumbnailUrl = thumbnailUrl;
            Title = string.IsNullOrWhiteSpace(title) 
                ? "Israel Hiking Map Shared Route" 
                : WebUtility.HtmlEncode(title);
            Description = string.IsNullOrWhiteSpace(description) 
                ? "בין אם אתם יוצאים לטיול רגלי, רכיבה על אופניים או נסיעה ברכב שטח, כאן תוכלו למצוא כל מה שאתם צריכים על מנת לתכנן את הביקור הבא שלכם בטבע." 
                : WebUtility.HtmlEncode(description);
        }
    }

    /// <summary>
    /// This contoller is used to return an HTML page for facebook crawler
    /// </summary>
    public class OpenGraphController : ApiController
    {
        private readonly ILogger _logger;
        private readonly IIsraelHikingRepository _repository;

        /// <summary>
        /// Controller's constructor
        /// </summary>
        /// <param name="repository"></param>
        /// <param name="logger"></param>
        public OpenGraphController(IIsraelHikingRepository repository, 
            ILogger logger)
        {
            _repository = repository;
            _logger = logger;
        }

        /// <summary>
        /// Get the HTML page needed for facebook crawler
        /// </summary>
        /// <param name="id">The ID of the shared route</param>
        /// <returns>An HTML page with all relevant metadata</returns>
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
