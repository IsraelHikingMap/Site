using IsraelHiking.API.Services.Poi;
using IsraelHiking.Common.Configuration;
using IsraelHiking.DataAccessInterfaces.Repositories;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Http.Extensions;
using Microsoft.Extensions.FileProviders;
using Microsoft.Extensions.Options;
using System.Linq;
using System.Net;
using System.Text.RegularExpressions;
using System.Threading.Tasks;
using Wangkanai.Detection.Services;

namespace IsraelHiking.API.Services
{
    /// <summary>
    /// This middleware is responsible in returning the index.html file or a simple page with info for the crawlers
    /// </summary>
    public class NonApiMiddleware
    {
        private readonly IWebHostEnvironment _environment;
        private readonly IRepository _repository;
        private readonly IPointsOfInterestProvider _pointsOfInterestProvider;
        private readonly ConfigurationData _options;

        /// <summary>
        /// Constcutor
        /// </summary>
        /// <param name="next"></param>
        /// <param name="environment"></param>
        /// <param name="repository"></param>
        /// <param name="pointsOfInterestProvider"></param>
        /// <param name="options"></param>
        public NonApiMiddleware(RequestDelegate next, IWebHostEnvironment environment,
            IRepository repository,
            IPointsOfInterestProvider pointsOfInterestProvider,
            IOptions<ConfigurationData> options)
        {
            _environment = environment;
            _repository = repository;
            _options = options.Value;
            _pointsOfInterestProvider = pointsOfInterestProvider;
        }

        /// <summary>
        /// Main middleware method required for asp.net
        /// </summary>
        /// <param name="context"></param>
        /// <param name="detectionService"></param>
        /// <returns></returns>
        public async Task InvokeAsync(HttpContext context, IDetectionService detectionService)
        {
            if (_options.ListingDictionary.Keys.Any(k => context.Request.Path.StartsWithSegments("/" + k)))
            {
                context.Response.StatusCode = 404;
                var file = _environment.WebRootFileProvider.GetFileInfo("/resource-not-found.html");
                await SendFile(context, file);
                return;
            }
            var isCrawler = detectionService.Crawler.IsCrawler;
            var isWhatsApp = detectionService.Crawler.Type == Wangkanai.Detection.Models.Crawler.WhatsApp;
            if (isCrawler && context.Request.Path.StartsWithSegments("/share"))
            {
                var url = await _repository.GetUrlById(context.Request.Path.Value.Split("/").Last());
                var title = string.IsNullOrWhiteSpace(url.Title) ? "Israel Hiking Map Route Share" : url.Title;
                var thumbnailUrl = context.Request.GetDisplayUrl().Replace("/share/", "/api/images/");
                if (isWhatsApp)
                {
                    thumbnailUrl += "?width=256&height=256";
                }
                await Write(context, GetPage(title, thumbnailUrl, url.Description));
                return;
            }
            if (isCrawler && context.Request.Path.StartsWithSegments("/poi"))
            {
                var split = context.Request.Path.Value.Split("/");
                context.Request.Query.TryGetValue("language", out var language);
                var point = await _pointsOfInterestProvider.GetPointOfInterestById(split[split.Length - 2], split.Last(), language.FirstOrDefault());
                if (point == null)
                {
                    var invalidPoi = _environment.WebRootFileProvider.GetFileInfo("/index.html");
                    await SendFile(context, invalidPoi);
                    return;
                }
                var thumbnailUrl = point.ImagesUrls.FirstOrDefault() ?? string.Empty;
                if (isWhatsApp)
                {
                    thumbnailUrl = Regex.Replace(thumbnailUrl, @"(http.*\/\/upload\.wikimedia\.org\/wikipedia\/commons\/)(.*\/)(.*)", "$1thumb/$2$3/200px-$3");
                }
                await Write(context, GetPage(point.Title, thumbnailUrl, point.Description));
                return;
            }

            var defaultFile = _environment.WebRootFileProvider.GetFileInfo("/index.html");
            await SendFile(context, defaultFile);
        }

        private Task SendFile(HttpContext context, IFileInfo file)
        {
            context.Response.ContentType = "text/html";
            context.Response.ContentLength = file.Length;
            return context.Response.SendFileAsync(file);
        }

        private Task Write(HttpContext context, string text)
        {
            context.Response.ContentType = "text/html";
            return context.Response.WriteAsync(text);
        }

        /// <summary>
        /// This method is used to create a page with information for crawlers
        /// </summary>
        /// <param name="title"></param>
        /// <param name="thumbnailUrl"></param>
        /// <param name="description"></param>
        /// <returns></returns>
        public static string GetPage(string title, string thumbnailUrl, string description)
        {
            title = string.IsNullOrWhiteSpace(title)
                ? "Israel Hiking Map"
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
                    <meta property='og:image:secure_url' content='{thumbnailUrl.Replace("http://", "https://")}' />
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
    }
}
