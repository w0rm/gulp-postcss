var Stream = require('stream')
var postcss = require('postcss')
var applySourceMap = require('vinyl-sourcemaps-apply')
var gutil = require('gulp-util')
var path = require('path')


module.exports = function (processors, options) {

  if (!Array.isArray(processors)) {
    throw new gutil.PluginError('gulp-postcss', 'Please provide array of postcss processors!')
  }

  var stream = new Stream.Transform({ objectMode: true })

  stream._transform = function (file, encoding, cb) {

    if (file.isNull()) {
      return cb(null, file)
    }

    if (file.isStream()) {
      return handleError('Streams are not supported!')
    }

    // Source map is disabled by default
    var opts = { map: false }
    var attr

    // Extend default options
    if (options) {
      for (attr in options) {
        if (options.hasOwnProperty(attr)) {
          opts[attr] = options[attr]
        }
      }
    }

    opts.from = file.path
    opts.to = opts.to || file.path

    // Generate separate source map for gulp-sourcemap
    if (file.sourceMap) {
      opts.map = { annotation: false }
    }

    postcss(processors)
      .process(file.contents, opts)
      .then(handleResult, handleError)

    function handleResult (result) {
      var map

      file.contents = new Buffer(result.css)

      // Apply source map to the chain
      if (file.sourceMap) {
        map = result.map.toJSON()
        map.file = file.relative
        map.sources = [].map.call(map.sources, function (source) {
          return path.join(path.dirname(file.relative), source)
        })
        applySourceMap(file, map)
      }

      file.postcss = result

      setImmediate(function () {
        cb(null, file)
      })
    }

    function handleError (error) {
      var errorOptions = { fileName: file.path, showStack: true }
      if (error.name === 'CssSyntaxError') {
        error = error.message + '\n\n' + error.showSourceCode() + '\n'
        errorOptions.showStack = false
      }
      // Prevent stream’s unhandled exception from
      // being suppressed by Promise
      setImmediate(function () {
        cb(new gutil.PluginError('gulp-postcss', error, errorOptions))
      })
    }

  }

  return stream
}

module.exports.reporter = function(options) {
  var isBrowser = options && options.selector || options.styles
  var reporter = require(isBrowser ? 'postcss-browser-reporter' : 'postcss-reporter')(options);
  var stream = new Stream.Transform({ objectMode: true })

  stream._transform = function (file, encoding, cb) {
    var result = file.postcss
    if (result) {
      reporter(result.root, result)
      if (isBrowser) {
        file.contents = new Buffer(result.css)
      }
    }
    cb(null, file)
  }
  return stream
}
