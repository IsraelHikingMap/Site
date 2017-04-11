using System;
using System.Collections.Generic;
using System.Globalization;
using System.Linq;
using System.Net;
using System.Text;
using System.Threading.Tasks;
using IsraelHiking.DataAccessInterfaces;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.StaticFiles;
using Microsoft.Extensions.FileProviders;

namespace IsraelHiking.API.Controllers
{
    /// <summary>
    /// This is a directory formatter that uses bootstrap and font awesome
    /// </summary>
    public class BootstrapFontAwesomeDirectoryFormatter : IDirectoryFormatter
    {
        private const int KILOBYTE = 1024;
        private const int MEGABYTE = KILOBYTE * KILOBYTE;
        private const int GIGABYTE = KILOBYTE * MEGABYTE;

        private readonly IFileSystemHelper _fileSystemHelper;

        /// <summary>
        /// Constructor
        /// </summary>
        /// <param name="fileSystemHelper"></param>
        public BootstrapFontAwesomeDirectoryFormatter(IFileSystemHelper fileSystemHelper)
        {
            _fileSystemHelper = fileSystemHelper;
        }

        /// <summary>
        /// Generates an HTML view for a directory.
        /// </summary>
        public async Task GenerateContentAsync(HttpContext context, IEnumerable<IFileInfo> contents)
        {
            if (context == null)
            {
                throw new ArgumentNullException(nameof(context));
            }
            if (contents == null)
            {
                throw new ArgumentNullException(nameof(contents));
            }

            context.Response.ContentType = "text/html;charset=UTF-8";

            if (context.Request.Method.ToUpper() == "HEAD")
            {
                // HEAD, no response body
                return;
            }

            PathString requestPath = context.Request.PathBase + context.Request.Path;

            var builder = new StringBuilder();

            builder.AppendFormat($@"
                <!DOCTYPE html>
                <html lang='{CultureInfo.CurrentUICulture.TwoLetterISOLanguageName}'>
                <head>
                    <title>Index Of {HtmlEncode(requestPath.Value)}</title>
                    <link rel='stylesheet' href='/content/bootstrap.min.css' />
                    <link rel='stylesheet' href='/content/font-awesome.min.css' />
                </head>
                <body>
                    <div class='container'>
                    <h1>Index Of <a href='/'>/</a>{GetHeaderLinks(requestPath)}</h1>
                    <table class='table table-hover'>
                        <thead>
			            <tr>
				            <th></th>
				            <th>Name</th>
				            <th>Size</th>
				            <th>Last Modified</th>
			            </tr>
			            </thead>
			            <tbody>
                            {GetTableLines(contents.ToList())}
                        </tbody>
                    </table>
	            </div>
            </body>
            </html>
            ");
            await context.Response.WriteAsync(builder.ToString());
        }

        private string GetHeaderLinks(PathString requestPath)
        {
            string cumulativePath = "/";
            var header = "";
            foreach (var segment in requestPath.Value.Split(new[] { '/' }, StringSplitOptions.RemoveEmptyEntries))
            {
                cumulativePath = cumulativePath + segment + "/";
                header += $@"<a href='{HtmlEncode(cumulativePath)}'>{HtmlEncode(segment)}/</a>";
            }
            return header;
        }

        private string GetTableLines(List<IFileInfo> contents)
        {
            var builder = new StringBuilder();
            foreach (var subdir in contents.Where(info => info.IsDirectory && !_fileSystemHelper.IsHidden(info.PhysicalPath)))
            {
                builder.AppendFormat($@"
                    <tr>
                        <td><i class='fa fa-lg fa-folder-open'></i></td>
                        <td><a href='{HtmlEncode(subdir.Name)}/'>{HtmlEncode(subdir.Name)}/</a></td>
                        <td></td>
                        <td>{HtmlEncode(subdir.LastModified.LocalDateTime.ToString("dd/MM/yyyy HH:mm"))}</td>
                    </tr>
                    ");
            }
            foreach (var file in contents.Where(info => !info.IsDirectory && !_fileSystemHelper.IsHidden(info.PhysicalPath)))
            {
                builder.AppendFormat($@"
                  <tr>
                    <td><i class='fa fa-lg {GetFontAwesomeIcon(file.Name)}'></i></td>
                    <td><a href='{HtmlEncode(file.Name)}'>{HtmlEncode(file.Name)}</a></td>
                    <td>{GetLengthString(file.Length)}</td>
                    <td>{HtmlEncode(file.LastModified.LocalDateTime.ToString("dd/MM/yyyy HH:mm"))}</td>
                  </tr>
                ");
            }
            return builder.ToString();
        }

        private string GetLengthString(double number)
        {
            string units;
            double convertedNumber;
            if (number > GIGABYTE)
            {
                units = "Gb";
                convertedNumber = number * 1.0 / GIGABYTE;
            }
            else if (number > MEGABYTE)
            {
                units = "Mb";
                convertedNumber = number * 1.0 / MEGABYTE;
            }
            else if (number > KILOBYTE)
            {
                units = "Kb";
                convertedNumber = number / KILOBYTE;
            }
            else
            {
                units = "b";
                convertedNumber = number;
            }
            return Convert.ToDouble($"{convertedNumber:G2}").ToString("R0") + " " + units;
        }

        private string GetFontAwesomeIcon(string fileName)
        {
            var fileExtension = fileName.Split('.').Last();
            switch (fileExtension)
            {
                case "xml":
                    return "fa-file-code-o";
                case "zip":
                    return "fa-file-zip-o";
                case "png":
                case "jpg":
                case "bmp":
                case "gif":
                    return "fa-file-image-o";
                default:
                    return "fa-file-text-o";
            }
        }

        private static string HtmlEncode(string body)
        {
            return WebUtility.HtmlEncode(body);
        }
    }
}
