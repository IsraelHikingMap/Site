using System;
using System.Text.RegularExpressions;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Http.Extensions;
using Microsoft.AspNetCore.Rewrite;

namespace IsraelHiking.Web
{
    // workaround until issue is resolved:
    // https://github.com/aspnet/BasicMiddleware/issues/194

    public class RewriteWithQueryRule : IRule
    {
        private readonly TimeSpan _regexTimeout = TimeSpan.FromSeconds(1);
        public Regex InitialMatch { get; }
        public string Replacement { get; }
        public bool StopProcessing { get; }
        public RewriteWithQueryRule(string regex, string replacement, bool stopProcessing)
        {
            if (string.IsNullOrEmpty(regex))
            {
                throw new ArgumentException(nameof(regex));
            }

            if (string.IsNullOrEmpty(replacement))
            {
                throw new ArgumentException(nameof(replacement));
            }

            InitialMatch = new Regex(regex, RegexOptions.Compiled | RegexOptions.CultureInvariant, _regexTimeout);
            Replacement = replacement;
            StopProcessing = stopProcessing;
        }

        public virtual void ApplyRule(RewriteContext context)
        {
            var pathWithQuery = context.HttpContext.Request.Path + context.HttpContext.Request.QueryString;
            var initMatchResults = InitialMatch.Match(pathWithQuery == PathString.Empty 
                ? pathWithQuery 
                : pathWithQuery.Substring(1));
            if (!initMatchResults.Success)
            {
                return;
            }
            var result = initMatchResults.Result(Replacement);
            var request = context.HttpContext.Request;

            if (StopProcessing)
            {
                context.Result = RuleResult.SkipRemainingRules;
            }

            if (string.IsNullOrEmpty(result))
            {
                result = "/";
            }

            if (result.IndexOf("://", StringComparison.Ordinal) >= 0)
            {
                UriHelper.FromAbsolute(result, out var scheme, out var host, out var pathString, out var query, out FragmentString _);

                request.Scheme = scheme;
                request.Host = host;
                request.Path = pathString;
                request.QueryString = query.Add(request.QueryString);
            }
            else
            {
                var split = result.IndexOf('?');
                if (split >= 0)
                {
                    var newPath = result.Substring(0, split);
                    request.Path = newPath[0] == '/' 
                        ? PathString.FromUriComponent(newPath) 
                        : PathString.FromUriComponent('/' + newPath);
                    request.QueryString = request.QueryString.Add(QueryString.FromUriComponent(result.Substring(split)));
                }
                else
                {
                    request.Path = result[0] == '/' 
                        ? PathString.FromUriComponent(result) 
                        : PathString.FromUriComponent('/' + result);
                }
            }
        }
    }
}