// Karma configuration file, see link for more information
// https://karma-runner.github.io/0.13/config/configuration-file.html

module.exports = function (config) {
    config.set({
        basePath: "",
        frameworks: ["jasmine", "@angular-devkit/build-angular"],
        plugins: [
            require("karma-jasmine"),
            require("karma-chrome-launcher"),
            require("karma-jasmine-html-reporter"),
            require("karma-coverage"),
            require("karma-junit-reporter"),
        ],
        client: {
            clearContext: false // leave Jasmine Spec Runner output visible in browser
        },
        coverageReporter: {
            dir: require("path").join(__dirname, "coverage"),
            subdir: ".",
            reporters: [
              { type: "html" },
              { type: "lcovonly" }
            ]
          },
        
        reporters: ["progress", "kjhtml", "junit"],
        port: 9876,
        colors: true,
        captureTimeout: 300000,
        browserNoActivityTimeout: 300000,
        processKillTimeout: 60000,
        browserSocketTimeout: 300000,
        logLevel: config.LOG_INFO,
        autoWatch: true,
        browsers: ['ChromeNoSandbox'],
        customLaunchers: {	
            ChromeNoSandbox: {	
                base: 'ChromeHeadless',	
                flags: ['--no-sandbox', '--window-size=1920,1080'],	
            },	
        },
        singleRun: false
    });
};
