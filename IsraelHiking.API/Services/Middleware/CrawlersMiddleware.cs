﻿using System.Linq;
using System.Text.RegularExpressions;
using System.Threading.Tasks;
using IsraelHiking.API.Services.Poi;
using IsraelHiking.Common;
using IsraelHiking.Common.Extensions;
using IsraelHiking.DataAccessInterfaces.Repositories;
using Microsoft.AspNetCore.Http;
using Wangkanai.Detection.Services;

namespace IsraelHiking.API.Services.Middleware
{
    /// <summary>
    /// This middleware is responsible in returning a simple page with info for the crawlers
    /// </summary>
    public class CrawlersMiddleware
    {
        private readonly IShareUrlsRepository _shareUrlsRepository;
        private readonly IPointsOfInterestProvider _pointsOfInterestProvider;
        private readonly RequestDelegate _next;
        private readonly IHomePageHelper _homePageHelper;

        /// <summary>
        /// Constructor
        /// </summary>
        /// <param name="next"></param>
        /// <param name="homePageHelper"></param>
        /// <param name="shareUrlsRepository"></param>
        /// <param name="pointsOfInterestProvider"></param>
        public CrawlersMiddleware(RequestDelegate next,
            IHomePageHelper homePageHelper,
            IShareUrlsRepository shareUrlsRepository,
            IPointsOfInterestProvider pointsOfInterestProvider)
        {
            _next = next;
            _homePageHelper = homePageHelper;

            _shareUrlsRepository = shareUrlsRepository;
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
            if (context.Request.Path.StartsWithSegments("/api"))
            {
                await _next.Invoke(context);
                return;
            }
            var isCrawler = detectionService.Crawler.IsCrawler;
            if (!isCrawler)
            {
                await _next.Invoke(context);
                return;
            }
            var isWhatsApp = detectionService.Crawler.Name == Wangkanai.Detection.Models.Crawler.WhatsApp;
            if (context.Request.Path.StartsWithSegments("/share"))
            {
                var url = await _shareUrlsRepository.GetUrlById(context.Request.Path.Value.Split("/").Last());
                if (url == null) {
                    await _next.Invoke(context);
                    return;
                }
                
                var title = string.IsNullOrWhiteSpace(url.Title) ? Branding.ROUTE_SHARE_DEFAULT_TITLE : url.Title;
                var thumbnailUrl = "https://israelhiking.osm.org.il/api/images/" + url.Id;
                if (isWhatsApp)
                {
                    thumbnailUrl += "?width=256&height=256";
                }

                await WriteHomePage(context, title, thumbnailUrl, url.Description);
                return;
            }
            if (context.Request.Path.StartsWithSegments("/poi"))
            {
                var split = context.Request.Path.Value.Split("/");
                context.Request.Query.TryGetValue("language", out var languages);
                var language = languages.FirstOrDefault() ?? Languages.HEBREW;
                var feature = await _pointsOfInterestProvider.GetFeatureById(split[split.Length - 2], split.Last());
                if (feature == null)
                {
                    await _next.Invoke(context);
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
                await WriteHomePage(context, feature.GetTitle(language), thumbnailUrl, feature.GetDescriptionWithExternal(language), language);
            }
            await _next.Invoke(context);
        }

        private Task WriteHomePage(HttpContext context, string title, string thumbnailUrl, string description, string language="")
        {
            string text = _homePageHelper.Render(title, description, thumbnailUrl,language);
            context.Response.ContentType = "text/html";
            return context.Response.WriteAsync(text);
        }
    }
}
