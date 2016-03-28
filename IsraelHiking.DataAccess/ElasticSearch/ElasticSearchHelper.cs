using IsraelHiking.DataAccessInterfaces;

namespace IsraelHiking.DataAccess.ElasticSearch
{
    public class ElasticSearchHelper : BaseNssmHelper
    {
        protected override string RelativePath => "ElasticSearch";
        protected override string Name => "\"Elastic Search Service\"";
        protected override string Description => "Name search service for israel hiking site";
        protected override string CommandLine => "java -Delasticsearch -Des-foreground=yes -Des.path.home=\"./ \" -cp \"lib/elasticsearch-2.2.1.jar;lib/*\" \"org.elasticsearch.bootstrap.Elasticsearch\" start";

        public ElasticSearchHelper(ILogger logger, IProcessHelper processHelper) : base(logger, processHelper)
        {
        }


    }
}
