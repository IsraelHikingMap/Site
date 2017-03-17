using System;
using System.Collections.Generic;
using Microsoft.EntityFrameworkCore.Migrations;

namespace IsraelHiking.DataAccess.Migrations
{
    public partial class Initial : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "SiteUrls",
                columns: table => new
                {
                    Id = table.Column<string>(nullable: false),
                    CreationDate = table.Column<DateTime>(nullable: false),
                    Description = table.Column<string>(nullable: true),
                    JsonData = table.Column<string>(nullable: true),
                    LastViewed = table.Column<DateTime>(nullable: false),
                    OsmUserId = table.Column<string>(nullable: true),
                    Title = table.Column<string>(nullable: true),
                    ViewsCount = table.Column<int>(nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_SiteShares", x => x.Id);
                });
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "SiteUrls");
        }
    }
}
