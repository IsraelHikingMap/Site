using System;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Metadata;
using Microsoft.EntityFrameworkCore.Migrations;
using IsraelHiking.DataAccess.Database;

namespace IsraelHiking.DataAccess.Migrations
{
    [DbContext(typeof(IsraelHikingDbContext))]
    partial class IsraelHikingDbContextModelSnapshot : ModelSnapshot
    {
        protected override void BuildModel(ModelBuilder modelBuilder)
        {
            modelBuilder
                .HasAnnotation("ProductVersion", "1.1.0-rtm-22752");

            modelBuilder.Entity("IsraelHiking.Common.SiteUrl", b =>
                {
                    b.Property<string>("Id")
                        .ValueGeneratedOnAdd();

                    b.Property<DateTime>("CreationDate");

                    b.Property<string>("Description");

                    b.Property<string>("JsonData");

                    b.Property<DateTime>("LastViewed");

                    b.Property<string>("OsmUserId");

                    b.Property<string>("Title");

                    b.Property<int>("ViewsCount");

                    b.HasKey("Id");

                    b.ToTable("SiteUrls");
                });
        }
    }
}
