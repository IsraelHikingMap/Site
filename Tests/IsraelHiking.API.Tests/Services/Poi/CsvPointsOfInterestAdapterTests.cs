using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Text;
using System.Text.RegularExpressions;
using CsvHelper;
using GeoAPI.Geometries;
using IsraelHiking.API.Executors;
using IsraelHiking.API.Services;
using IsraelHiking.API.Services.Poi;
using IsraelHiking.Common;
using IsraelHiking.DataAccessInterfaces;
using Microsoft.Extensions.FileProviders;
using Microsoft.Extensions.Logging;
using Microsoft.VisualStudio.TestTools.UnitTesting;
using NSubstitute;

namespace IsraelHiking.API.Tests.Services.Poi
{
    internal class CsvRow : CsvPointOfInterestRow
    {
        public int ITMwest { get; set; }
        public int ITMnorth { get; set; }
    }


    [TestClass]
    public class CsvPointsOfInterestAdapterTests
    {
        private CsvPointsOfInterestAdapter _adapter;
        private IElevationDataStorage _elevationDataStorage;
        private IElasticSearchGateway _elasticSearchGateway;
        private IDataContainerConverterService _dataContainerConverterService;
        private IFileProvider _fileProvider;
        private IHttpGatewayFactory _httpGatewayFactory;
        private IItmWgs84MathTransfromFactory _itmWgs84MathTransfromFactory;

        [TestInitialize]
        public void TestInitialize()
        {
            _itmWgs84MathTransfromFactory = new ItmWgs84MathTransfromFactory();
            _httpGatewayFactory = Substitute.For<IHttpGatewayFactory>();
            _adapter = new CsvPointsOfInterestAdapter(_elevationDataStorage, _elasticSearchGateway, _dataContainerConverterService, _itmWgs84MathTransfromFactory, _fileProvider, _httpGatewayFactory, Substitute.For<ILogger>());
        }

        [TestMethod]
        [Ignore]
        public void ConvertEMaayanot()
        {
            var inputStream = File.OpenRead(@"C:\Users\harel\Desktop\Mapping\eMaayanot.csv");
            var reader = new StreamReader(inputStream);
            var csvReader = new CsvReader(reader);
            csvReader.Configuration.HeaderValidated = null;
            csvReader.Configuration.MissingFieldFound = null;
            var pointsOfInterest = csvReader.GetRecords<CsvRow>().ToList();

            TextWriter writer = File.CreateText(@"C:\Users\harel\Desktop\Mapping\eMaayanot2.csv");
            var csvWriter = new CsvWriter(writer);
            csvWriter.Configuration.HasHeaderRecord = true;
            csvWriter.WriteHeader<CsvPointOfInterestRow>();
            csvWriter.NextRecord();
            var transform = _itmWgs84MathTransfromFactory.Create();
            foreach (var csvRow in pointsOfInterest)
            {
                var coordinates = transform.Transform(new Coordinate(csvRow.ITMwest, csvRow.ITMnorth));
                csvRow.Latitude = coordinates.Y;
                csvRow.Longitude = coordinates.X;
                csvRow.Website = csvRow.Website.Substring(0, csvRow.Website.IndexOf("&T="));
                csvRow.Icon = "icon-tint";
                csvRow.IconColor = "blue";
                csvRow.Category = Categories.WATER;
                csvRow.Id = Regex.Match(csvRow.Website, @"&mayan=(\d+)").Groups[1].Value;
                csvWriter.WriteRecord<CsvPointOfInterestRow>(csvRow);
                csvWriter.NextRecord();
            }
            csvWriter.Flush();
            writer.Flush();
            writer.Dispose();
        }
    }
}
