using System.Collections.Generic;
using System.Data.Entity;
using System.Data.Entity.Infrastructure;
using System.Diagnostics.CodeAnalysis;
using System.Linq;
using System.Linq.Expressions;
using System.Threading;
using System.Threading.Tasks;
using IsraelHiking.Common;
using IsraelHiking.DataAccess.Database;
using IsraelHiking.DataAccessInterfaces;
using Microsoft.VisualStudio.TestTools.UnitTesting;
using NSubstitute;

namespace IsraelHiking.DataAccess.Tests.Database
{
    [ExcludeFromCodeCoverage]
    internal class TestDbAsyncQueryProvider<TEntity> : IDbAsyncQueryProvider
    {
        private readonly IQueryProvider _inner;

        internal TestDbAsyncQueryProvider(IQueryProvider inner)
        {
            _inner = inner;
        }

        public IQueryable CreateQuery(Expression expression)
        {
            return new TestDbAsyncEnumerable<TEntity>(expression);
        }

        public IQueryable<TElement> CreateQuery<TElement>(Expression expression)
        {
            return new TestDbAsyncEnumerable<TElement>(expression);
        }

        public object Execute(Expression expression)
        {
            return _inner.Execute(expression);
        }

        public TResult Execute<TResult>(Expression expression)
        {
            return _inner.Execute<TResult>(expression);
        }

        public Task<object> ExecuteAsync(Expression expression, CancellationToken cancellationToken)
        {
            return Task.FromResult(Execute(expression));
        }

        public Task<TResult> ExecuteAsync<TResult>(Expression expression, CancellationToken cancellationToken)
        {
            return Task.FromResult(Execute<TResult>(expression));
        }
    }

    [ExcludeFromCodeCoverage]
    internal class TestDbAsyncEnumerable<T> : EnumerableQuery<T>, IDbAsyncEnumerable<T>, IQueryable<T>
    {
        public TestDbAsyncEnumerable(IEnumerable<T> enumerable)
            : base(enumerable)
        {
        }

        public TestDbAsyncEnumerable(Expression expression)
            : base(expression)
        {
        }

        public IDbAsyncEnumerator<T> GetAsyncEnumerator()
        {
            return new TestDbAsyncEnumerator<T>(this.AsEnumerable().GetEnumerator());
        }

        IDbAsyncEnumerator IDbAsyncEnumerable.GetAsyncEnumerator()
        {
            return GetAsyncEnumerator();
        }

        IQueryProvider IQueryable.Provider => new TestDbAsyncQueryProvider<T>(this);
    }

    [ExcludeFromCodeCoverage]
    internal class TestDbAsyncEnumerator<T> : IDbAsyncEnumerator<T>
    {
        private readonly IEnumerator<T> _inner;

        public TestDbAsyncEnumerator(IEnumerator<T> inner)
        {
            _inner = inner;
        }

        public void Dispose()
        {
            _inner.Dispose();
        }

        public Task<bool> MoveNextAsync(CancellationToken cancellationToken)
        {
            return Task.FromResult(_inner.MoveNext());
        }

        public T Current => _inner.Current;

        object IDbAsyncEnumerator.Current => Current;
    }

    [TestClass]
    public class IsraelHikingRepositoryTests
    {
        private IIsraelHikingRepository _israelHikingRepository;
        private IIsraelHikingDbContext _israelHikingDbContext;

        protected void SetupSiteUrls(List<SiteUrl> list = null)
        {
            var siteUrls = GetDbSet(list ?? new List<SiteUrl>());
            _israelHikingDbContext.SiteUrls.Returns(siteUrls.AsQueryable());
        }

        public IDbSet<TEntity> GetDbSet<TEntity>(List<TEntity> data) where TEntity : class
        {
            var queryable = data.AsQueryable();
            var mockSet = Substitute.For<IDbSet<TEntity>, IQueryable<TEntity>, IDbAsyncEnumerable<TEntity>>();
            mockSet.Expression.Returns(queryable.Expression);
            mockSet.ElementType.Returns(queryable.ElementType);
            mockSet.GetEnumerator().Returns(queryable.GetEnumerator());

            ((IDbAsyncEnumerable<TEntity>)mockSet).GetAsyncEnumerator()
                .Returns(new TestDbAsyncEnumerator<TEntity>(queryable.GetEnumerator()));
            mockSet.Provider.Returns(
                new TestDbAsyncQueryProvider<TEntity>(queryable.Provider));

            return mockSet;
        }

        [TestInitialize]
        public void TestInitialize()
        {
            _israelHikingDbContext = Substitute.For<IIsraelHikingDbContext>();
            _israelHikingRepository = new IsraelHikingRepository(_israelHikingDbContext);
        }

        [TestCleanup]
        public void TestCleanup()
        {
            _israelHikingRepository.Dispose();
        }

        [TestMethod]
        public void GetUrlById_ShouldReturnOne()
        {
            var siteUrl = new SiteUrl { Id = "42" };
            SetupSiteUrls(new List<SiteUrl> { siteUrl });

            var results = _israelHikingRepository.GetUrlById(siteUrl.Id).Result;

            Assert.AreEqual(siteUrl, results);
        }

        [TestMethod]
        public void GetUrlByModifyKey_ShouldReturnOne()
        {
            var siteUrl = new SiteUrl { ModifyKey = "42" };
            SetupSiteUrls(new List<SiteUrl> { siteUrl });

            var results = _israelHikingRepository.GetUrlByModifyKey(siteUrl.ModifyKey).Result;

            Assert.AreEqual(siteUrl, results);
        }

        [TestMethod]
        public void AddUrl_ShouldAdd()
        {
            var newSiteUrl = new SiteUrl();
            SetupSiteUrls();

            _israelHikingRepository.AddUrl(newSiteUrl).Wait();

            _israelHikingDbContext.SiteUrls.Received(1).Add(newSiteUrl);
        }

        [TestMethod]
        public void Update_ShouldUpdateDatabase()
        {
            var newSiteUrl = new SiteUrl();

            _israelHikingRepository.Update(newSiteUrl).Wait();

            _israelHikingDbContext.Received(1).MarkAsModified(newSiteUrl);
            _israelHikingDbContext.Received(1).SaveChangesAsync();
        }
    }
}
