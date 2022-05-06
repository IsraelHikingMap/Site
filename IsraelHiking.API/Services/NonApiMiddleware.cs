using System.Linq;
using System.Text.RegularExpressions;
using System.Threading.Tasks;
using IsraelHiking.API.Services.Poi;
using IsraelHiking.Common;
using IsraelHiking.Common.Configuration;
using IsraelHiking.Common.Extensions;
using IsraelHiking.DataAccessInterfaces.Repositories;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.FileProviders;
using Microsoft.Extensions.Options;
using Wangkanai.Detection.Models;
using Wangkanai.Detection.Services;

namespace IsraelHiking.API.Services
{
    /// <summary>
    /// This middleware is responsible in returning the index.html file or a simple page with info for the crawlers
    /// </summary>
    public class NonApiMiddleware
    {
        private readonly IWebHostEnvironment _environment;
        private readonly IShareUrlsRepository _shareUrlsRepository;
        private readonly IPointsOfInterestProvider _pointsOfInterestProvider;
        private readonly ConfigurationData _options;
        private readonly HomePageHelper _homePageHelper;

        /// <summary>
        /// Constcutor
        /// </summary>
        /// <param name="next"></param>
        /// <param name="environment"></param>
        /// <param name="homePageHelper"></param>
        /// <param name="shareUrlsRepository"></param>
        /// <param name="pointsOfInterestProvider"></param>
        /// <param name="options"></param>
        public NonApiMiddleware(RequestDelegate next, IWebHostEnvironment environment,
            HomePageHelper homePageHelper,
            IShareUrlsRepository shareUrlsRepository,
            IPointsOfInterestProvider pointsOfInterestProvider,
            IOptions<ConfigurationData> options)
        {
            _environment = environment;
            _homePageHelper = homePageHelper;

            _shareUrlsRepository = shareUrlsRepository;
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
            var isCrawler = detectionService.Crawler.IsCrawler;
            var isWhatsApp = detectionService.Crawler.Name == Wangkanai.Detection.Models.Crawler.WhatsApp;
            if (isCrawler && context.Request.Path.StartsWithSegments("/share"))
            {
                var url = await _shareUrlsRepository.GetUrlById(context.Request.Path.Value.Split("/").Last());
                if (url == null) {
                    await SendDefaultFile(context);
                    return;
                }
                
                var title = string.IsNullOrWhiteSpace(url.Title) ? "Israel Hiking Map Route Share" : url.Title;
                var thumbnailUrl = "https://israelhiking.osm.org.il/api/images/" + url.Id;
                if (isWhatsApp)
                {
                    thumbnailUrl += "?width=256&height=256";
                }

                await WriteHomePage(context, title, thumbnailUrl, url.Description);
                return;
            }
            if (isCrawler && context.Request.Path.StartsWithSegments("/poi"))
            {
                var split = context.Request.Path.Value.Split("/");
                context.Request.Query.TryGetValue("language", out var languages);
                var language = languages.FirstOrDefault() ?? "he";
                var feature = await _pointsOfInterestProvider.GetFeatureById(split[split.Length - 2], split.Last());
                if (feature == null)
                {
                    await SendDefaultFile(context);
                    return;
                }
                var thumbnailUrl = feature.Attributes.GetNames()
                    .Where(n => n.StartsWith(FeatureAttributes.IMAGE_URL))
                    .Select(p => feature.Attributes[p].ToString())
                    .FirstOrDefault() ?? string.Empty;
                if (isWhatsApp)
                {
                    thumbnailUrl = Regex.Replace(thumbnailUrl, @"(http.*\/\/upload\.wikimedia\.org\/wikipedia\/commons\/)(.*\/)(.*)", "$1thumb/$2$3/200px-$3");
                }
                feature.SetTitles();
                await WriteHomePage(context, feature.GetTitle(language), thumbnailUrl, feature.GetDescription(language), language);
                return;
            }

            await SendDefaultFile(context);
        }

        private async Task SendDefaultFile(HttpContext context) {
            await SendFile(context, _homePageHelper.GetFileInfo);
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

        private Task WriteHomePage(HttpContext context, string title, string thumbnailUrl, string description, string language="")
        {
            return Write(context, _homePageHelper.Render(title, description, thumbnailUrl, language));
        }
    }
}
