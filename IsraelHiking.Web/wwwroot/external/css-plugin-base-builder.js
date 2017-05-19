var fs = require('@node/fs');
var path = require('@node/path');

var postCssBundle = require('./postcss-bundle.js');

var postcss = postCssBundle.postcss;
var autoprefixer = postCssBundle.autoprefixer;
var cssnano = postCssBundle.cssnano;
var atImport = postCssBundle.atImport;
var atUrl = postCssBundle.atUrl;

var cssInject = "(function(c){if (typeof document == 'undefined') return; var d=document,a='appendChild',i='styleSheet',s=d.createElement('style');s.type='text/css';d.getElementsByTagName('head')[0][a](s);s[a](d.createTextNode(c));})";
var cssInjectSourceMaps = "(function(c){if (typeof document == 'undefined') return;var d=document,a='appendChild',s=d.createElement('link');s.rel='stylesheet';s.href=URL.createObjectURL(new Blob([c],{type:'text/css'}));d.getElementsByTagName('head')[0][a](s);})";

function escape(source) {
  return source
    .replace(/(["\\])/g, '\\$1')
    .replace(/[\f]/g, "\\f")
    .replace(/[\b]/g, "\\b")
    .replace(/[\n]/g, "\\n")
    .replace(/[\t]/g, "\\t")
    .replace(/[\r]/g, "\\r")
    .replace(/[\u2028]/g, "\\u2028")
    .replace(/[\u2029]/g, "\\u2029");
}

var isWin = process.platform.match(/^win/);
function fromFileURL(url) {
  return url.substr(7 + !!isWin).replace(/\//g, isWin ? '\\' : '/');
}

var listAssetsCnt = 0;
exports.listAssets = function(loads, opts) {
  // count the number of plugin phases inheriting this plugin
  listAssetsCnt++;
  return loads.map(function(load) {
    return {
      url: load.address,
      source: load.metadata.style,
      sourceMap: load.metadata.styleSourceMap,
      type: 'css'
    };
  });
};

var bundleCnt = 0;
var cssLoads = [];
exports.bundle = function(loads, compileOpts, outputOpts) {
  // count the number of phases inheriting this plugin
  // then apply reduction as a single process for the last one only
  bundleCnt++;
  cssLoads = cssLoads.concat(loads);

  if (bundleCnt != listAssetsCnt)
    return;

  var loader = this;

  // backwards compat with fileURL for rootURL
  if (loader.rootURL && loader.rootURL.substr(0, 5) == 'file:')
    loader.rootURL = fromFileURL(loader.rootURL);

  if (loader.browserRootURL && loader.browserRootURL[loader.browserRootURL.length - 1] !== '/')
    loader.browserRootURL += '/';

  // reset for next
  bundleCnt = listAssetsCnt = 0;

  var baseURLPath = fromFileURL(loader.baseURL);

  var inputFiles = {};
  cssLoads.forEach(function(load) {
    inputFiles[path.relative(baseURLPath, fromFileURL(load.address))] = {
      source: load.metadata.style,
      sourceMap: load.metadata.styleSourceMap
    };
  });
  cssLoads = [];

  var absRegEx = /^[a-z]+:/;
  function absUrl(url) {
    return url[0] !== '.' && (url.match(absRegEx) || url[0] === '/');
  }

  var cwd = process.cwd();

  var postCssPlugins = [atImport({
    resolve: function(fileName, dirname, opts) {
      if (absUrl(fileName))
        return fileName;
      return path.relative(baseURLPath, path.join(dirname, fileName));
    },
    load: function(fileName, opts) {
      if (absUrl(fileName))
        return;

      var file = inputFiles[fileName];

      if (!file) {
        console.log(fileName + ' not found! TODO: ensure these imports are normalized correctly.');
        return;
      }

      var sourceMap = file.sourceMap;
      if (sourceMap) {
        if (typeof sourceMap === 'string')
          sourceMap = JSON.parse(sourceMap);

        // normalize input sources to use absolute file paths
        sourceMap.sources = sourceMap.sources.map(source => {
          if (source.match(absRegEx))
            return source;
          if (source[0] !== '/')
            return path.resolve(path.dirname(path.resolve(baseURLPath, fileName)), source);
          return source;
        });

        file.sourceMap = sourceMap;
      }

      return file;
    }
  }), atUrl({
    url: function(fileName, decl, from, dirname, to, options, result) {
      if (absUrl(fileName))
        return fileName;

      // dirname may be renormalized to cwd
      if (dirname.substr(0, cwd.length + 1) === cwd + path.sep)
        dirname = path.resolve(baseURLPath, dirname.substr(cwd.length + 1));

      if (loader.rootURL)
        return (loader.browserRootURL || '/') + path.relative(loader.rootURL, path.join(dirname, fileName)).replace(/\\/g, '/');
      else
        return path.relative(baseURLPath, path.join(dirname, fileName)).replace(/\\/g, '/');
    }
  }), autoprefixer];

  if (loader.cssNano !== false)
    postCssPlugins.push(cssnano({
      safe: true,
      normalizeUrl: false
    }));

  return postcss(postCssPlugins)
  .process(Object.keys(inputFiles).map(name => '@import "' + name + '";').join('\n'), {
    from: path.join(baseURLPath, '__.css'),
    to: cwd + path.sep + '__.css',
    map: {
      inline: false,
      sourcesContent: false
    }
  })
  .then(function(result) {
    var cssOutput = result.css;

    // write a separate CSS file if necessary
    if (loader.separateCSS) {
      var outFile = path.resolve(outputOpts.outFile).replace(/\.js$/, '.css');
      if (outputOpts.sourceMaps) {
        fs.writeFileSync(outFile + '.map', result.map.toString());
        cssOutput += '\n/*# sourceMappingURL=' + outFile.split(/[\\/]/).pop() + '.map*/';
      }

      fs.writeFileSync(outFile, cssOutput);
    }
    else {
      // this can be disabled pending https://bugs.chromium.org/p/chromium/issues/detail?id=649679&can=2&q=css%20source%20maps
      if (outputOpts.sourceMaps && loader.inlineCssSourceMaps) {
        var sourceMap = JSON.parse(result.map.toString());
        sourceMap.sources = sourceMap.sources.map(source => {
          if (source.match(absRegEx))
            return source;
          if (source[0] !== '/')
            source = path.resolve(baseURLPath, source);
          if (loader.rootURL)
            return (loader.browserRootURL || '/') + path.relative(loader.rootURL, source).replace(/\\/g, '/');
          else
            return path.relative(baseURLPath, source).replace(/\\/g, '/');
        });
        cssOutput += '\n/*# sourceMappingURL=data:application/json;base64,' + new Buffer(JSON.stringify(sourceMap)).toString('base64') + '*/';
        return cssInjectSourceMaps + '\n("' + escape(cssOutput) + '");';
      }
      else {
        return cssInject + '\n("' + escape(cssOutput) + '");';
      }
    }
  });
};
