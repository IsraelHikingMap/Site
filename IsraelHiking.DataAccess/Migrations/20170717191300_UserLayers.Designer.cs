using System;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Metadata;
using Microsoft.EntityFrameworkCore.Migrations;
using IsraelHiking.DataAccess.Database;

namespace IsraelHiking.DataAccess.Migrations
{
    [DbContext(typeof(IsraelHikingDbContext))]
    [Migration("20170717191300_UserLayers")]
    partial class UserLayers
    {
        protected override void BuildTargetModel(ModelBuilder modelBuilder)
        {
            modelBuilder
                .HasAnnotation("ProductVersion", "1.1.2");

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

            modelBuilder.Entity("IsraelHiking.Common.UserLayerData", b =>
                {
                    b.Property<long>("Id")
                        .ValueGeneratedOnAdd();

                    b.Property<string>("Address");

                    b.Property<bool>("IsOverlay");

                    b.Property<string>("Key");

                    b.Property<int?>("MaxZoom");

                    b.Property<int?>("MinZoom");

                    b.Property<long>("UserLayersId");

                    b.HasKey("Id");

                    b.HasIndex("UserLayersId");

                    b.ToTable("UserLayerData");
                });

            modelBuilder.Entity("IsraelHiking.Common.UserLayers", b =>
                {
                    b.Property<long>("Id")
                        .ValueGeneratedOnAdd();

                    b.Property<string>("OsmUserId");

                    b.HasKey("Id");

                    b.ToTable("UsersLayers");
                });

            modelBuilder.Entity("IsraelHiking.Common.UserLayerData", b =>
                {
                    b.HasOne("IsraelHiking.Common.UserLayers")
                        .WithMany("Layers")
                        .HasForeignKey("UserLayersId")
                        .OnDelete(DeleteBehavior.Cascade);
                });
        }
    }
}
