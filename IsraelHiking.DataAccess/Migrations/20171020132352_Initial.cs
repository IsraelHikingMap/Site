using Microsoft.EntityFrameworkCore.Migrations;
using System;
using System.Collections.Generic;

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
                    Id = table.Column<string>(type: "TEXT", nullable: false),
                    CreationDate = table.Column<DateTime>(type: "TEXT", nullable: false),
                    Description = table.Column<string>(type: "TEXT", nullable: true),
                    JsonData = table.Column<string>(type: "TEXT", nullable: true),
                    LastViewed = table.Column<DateTime>(type: "TEXT", nullable: false),
                    OsmUserId = table.Column<string>(type: "TEXT", nullable: true),
                    Title = table.Column<string>(type: "TEXT", nullable: true),
                    ViewsCount = table.Column<int>(type: "INTEGER", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_SiteUrls", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "UsersLayers",
                columns: table => new
                {
                    Id = table.Column<long>(type: "INTEGER", nullable: false)
                        .Annotation("Sqlite:Autoincrement", true),
                    OsmUserId = table.Column<string>(type: "TEXT", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_UsersLayers", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "UserLayerData",
                columns: table => new
                {
                    Id = table.Column<long>(type: "INTEGER", nullable: false)
                        .Annotation("Sqlite:Autoincrement", true),
                    Address = table.Column<string>(type: "TEXT", nullable: true),
                    IsOverlay = table.Column<bool>(type: "INTEGER", nullable: false),
                    Key = table.Column<string>(type: "TEXT", nullable: true),
                    MaxZoom = table.Column<int>(type: "INTEGER", nullable: true),
                    MinZoom = table.Column<int>(type: "INTEGER", nullable: true),
                    UserLayersId = table.Column<long>(type: "INTEGER", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_UserLayerData", x => x.Id);
                    table.ForeignKey(
                        name: "FK_UserLayerData_UsersLayers_UserLayersId",
                        column: x => x.UserLayersId,
                        principalTable: "UsersLayers",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_UserLayerData_UserLayersId",
                table: "UserLayerData",
                column: "UserLayersId");
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "SiteUrls");

            migrationBuilder.DropTable(
                name: "UserLayerData");

            migrationBuilder.DropTable(
                name: "UsersLayers");
        }
    }
}
