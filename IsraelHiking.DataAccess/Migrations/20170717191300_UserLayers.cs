using System;
using System.Collections.Generic;
using Microsoft.EntityFrameworkCore.Migrations;

namespace IsraelHiking.DataAccess.Migrations
{
    public partial class UserLayers : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "UsersLayers",
                columns: table => new
                {
                    Id = table.Column<long>(nullable: false)
                        .Annotation("Sqlite:Autoincrement", true),
                    OsmUserId = table.Column<string>(nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_UsersLayers", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "UserLayerData",
                columns: table => new
                {
                    Id = table.Column<long>(nullable: false)
                        .Annotation("Sqlite:Autoincrement", true),
                    Address = table.Column<string>(nullable: true),
                    IsOverlay = table.Column<bool>(nullable: false),
                    Key = table.Column<string>(nullable: true),
                    MaxZoom = table.Column<int>(nullable: true),
                    MinZoom = table.Column<int>(nullable: true),
                    UserLayersId = table.Column<long>(nullable: false)
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
                name: "UserLayerData");

            migrationBuilder.DropTable(
                name: "UsersLayers");
        }
    }
}
