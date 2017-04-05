using System.Net;
using System.Threading.Tasks;
using IsraelHiking.DataAccessInterfaces;
using Microsoft.Extensions.Logging;
using Microsoft.AspNetCore.Mvc;

namespace IsraelHiking.API.Controllers
{
    /// <summary>
    /// This contoller is used to return an HTML page for facebook crawler
    /// </summary>
    [Route("api/[controller]")]
    public class OpenGraphController : Controller
    {
        private readonly ILogger _logger;
        private IIsraelHikingRepository _repository;

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
        [HttpGet]
        [Route("{id}")]
        public async Task<IActionResult> GetHtml(string id)
        {
            _logger.LogDebug("Received a call to get html for: " + id);
            var url = await _repository.GetUrlById(id);
            var contentResult = new ContentResult
            {
                Content = GetPage(url.Title, Url.Content("~/api/images/" + url.Id), url.Description),
                ContentType = "text/html"
            };
            return contentResult;
        }

        private string GetPage(string title, string thumbnailUrl, string description)
        {
            title = string.IsNullOrWhiteSpace(title)
                ? "Israel Hiking Map Shared Route"
                : WebUtility.HtmlEncode(title);

            description = string.IsNullOrWhiteSpace(description)
                ? "בין אם אתם יוצאים לטיול רגלי, רכיבה על אופניים או נסיעה ברכב שטח, כאן תוכלו למצוא כל מה שאתם צריכים על מנת לתכנן את הביקור הבא שלכם בטבע."
                : WebUtility.HtmlEncode(description);

            return $@"
                <!DOCTYPE html>
                <html lang='en'>
                <head prefix='og: http://ogp.me/ns#'>
                    <meta content='text/html;charset=utf-8' http-equiv='Content-Type'>
                    <meta content='utf-8' http-equiv='encoding'>
                    <meta content='IE=edge, chrome=1' http-equiv='X-UA-Compatible' />
                    <meta property='og:site_name' content='IsraelHiking.OSM.org.il' />
                    <meta property='og:type' content='website' />
                    <meta property='og:title' content='{title}' />
                    <meta property='og:image' content='{thumbnailUrl}' />
                    <meta property='og:image:url' content='{thumbnailUrl}' />
                    <meta property='og:image:secure_url' content='{thumbnailUrl.Replace("http", "https")}' />
	                <meta property='og:image:width' content='600' />
                    <meta property='og:image:height' content='315' />
                    <meta property='og:description' content='{description}' />
                    <meta name='title' content='{title}' />
                    <meta name='description' content='{description}' />
                    <meta name='keyword' content='hike,bike,outdoor,israel hiking,map,navigation,route planning,nominatim,סימון שבילים,אופניים,מפה,ניווט,שטח,טיול,מטיבי לכת,ג'יפים,רכיבה,הליכה,טבע' />
                    <meta name='robot' content='index,follow' />
                    <meta name='msapplication-TileColor' content='#2b5797'>
                    <meta name='msapplication-TileImage' content='/content/images/favicons/mstile-144x144.png'>
                    <meta name='msapplication-config' content='/content/images/favicons/browserconfig.xml'>
                    <meta name='theme-color' content='#0a42bb'>
                    <meta name='viewport' content='width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no' />
                    <title>{title}</title>
                </head>
                <body>
                </body>
                </html>
            ";
        }

        /// <summary>
        /// Dispose method, follows dispoase pattern
        /// </summary>
        /// <param name="disposing"></param>
        protected override void Dispose(bool disposing)
        {
            if (disposing && _repository != null)
            {
                _repository.Dispose();
                _repository = null;
            }
            base.Dispose(disposing);
        }
    }
}
