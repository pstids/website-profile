'use strict';

// Include Gulp & Tools We'll Use
var gulp = require('gulp');
var $ = require('gulp-load-plugins')();
var del = require('del');
var runSequence = require('run-sequence');
var browserSync = require('browser-sync');
var reload = browserSync.reload;
var merge = require('merge-stream');
var path = require('path');
var fs = require('fs');
var glob = require('glob');
var historyApiFallback = require('connect-history-api-fallback');
var autoprefixer = require('gulp-autoprefixer');
var concat = require('gulp-concat');

var styleTask = function (stylesPath, srcs) {
  return gulp.src(srcs.map(function(src) {
      return path.join('app', stylesPath, src);
    }))
    .pipe($.changed(stylesPath, {extension: '.css'}))
    .pipe(autoprefixer({
      browsers: ['last 2 versions'],
      cascade: false
    }))
    .pipe(gulp.dest('.tmp/' + stylesPath))
    .pipe($.if('*.css', $.cssmin()))
    .pipe(gulp.dest('dist/' + stylesPath))
    .pipe($.size({title: stylesPath}));
};

// Compile and Automatically Prefix Stylesheets
gulp.task('styles', function () {
  return styleTask('styles', ['**/*.css']);
});

gulp.task('elements', function () {
  return styleTask('elements', ['**/*.css']);
});

// Lint JavaScript
gulp.task('jshint', function () {
  return gulp.src([
      'app/scripts/**/*.js',
      '!app/scripts/dropzone.js',
      '!app/scripts/external.js',
      '!app/scripts/superagent.js',
      '!app/scripts/dexie.js',
      '!app/scripts/moment.js',
      '!app/scripts/amcharts/**/*',
      'app/elements/**/*.js',
      'app/elements/**/*.html'
    ])
    .pipe($.jshint.extract()) // Extract JS from .html files
    .pipe($.jshint({
      camelcase: false,
      predef: [
        'jwt',
        'user',
        'superagent',
        'setDate',
        'speedToPace',
        'speedToPaceInDecimal',
        'workoutProcessing',
        'workoutFetching',
        'arraysEqual',
        'addLog',
        'logsProcessing',
        'logsFetching',
        'sampleFetching',
        'truncate',
        'fillZero',
        'hmsTime',
        'google',
        'meterToKM',
        'meterToUserUnit',
        'hrTime',
        'meterToMile',
        'speedToPaceForBalloon',
        'speedToPaceForValueAxis',
        'durationToSec',
        'secToDuration', 
        'secToDurationFull',
        'windowFocusEvent',
        'formatPace',
        'attribute',
        'moment',
        'addLog',
        'trainingPlan'
      ]
    }))
    .pipe($.jshint.reporter('jshint-stylish'))
    .pipe($.if(!browserSync.active, $.jshint.reporter('fail')));
});

// Optimize Images
gulp.task('images', function () {
  return gulp.src([
      'app/images/**/*',
      '!app/images/mountain_outline.svg'
    ])
    .pipe($.cache($.imagemin({
      progressive: true,
      interlaced: true
    })))
    .pipe(gulp.dest('dist/images'))
    .pipe($.size({title: 'images'}));
});

// gulp-cache need clear in the case of image path being changed
gulp.task('clear', function (done) {
    return $.cache.clearAll(done);
});

gulp.task('js', function () {
    return gulp.src([
        'app/**/*.{js,html}',
        '!app/scripts/external.js',
        '!app/scripts/dropzone.js',
        '!app/scripts/superagent.js',
        '!app/scripts/dexie.js',
        '!app/scripts/moment.js',
        '!app/scripts/amcharts/**/*',
    ])
    .pipe($.sourcemaps.init())
    .pipe($.if('*.html', $.crisper())) // Extract JS from .html files
    .pipe($.if('*.js', $.babel()))
    .pipe($.sourcemaps.write('.'))
    .pipe(gulp.dest('.tmp/'))
    .pipe(gulp.dest('dist/'));
});

// Copy All Files At The Root Level (app)
gulp.task('copy', function () {
  var app = gulp.src([
    'app/*',
    '!app/test',
    '!app/precache.json'
  ], {
    dot: true
  }).pipe(gulp.dest('dist'));

  var bower = gulp.src([
    'bower_components/**/*'
  ]).pipe(gulp.dest('dist/bower_components'));

  var elements = gulp.src(['app/elements/**/*.html'])
    .pipe(gulp.dest('dist/elements'));

  var swBootstrap = gulp.src(['bower_components/platinum-sw/bootstrap/*.js'])
    .pipe(gulp.dest('dist/elements/bootstrap'));

  var swToolbox = gulp.src(['bower_components/sw-toolbox/*.js'])
    .pipe(gulp.dest('dist/sw-toolbox'));

  var scripts = gulp.src([
    'app/scripts/dropzone.js',
    'app/scripts/processor.js',
    'app/scripts/superagent.js',
    'app/scripts/toolbox.js',
    'app/scripts/dexie.js',
    'app/scripts/external.js'
    'app/scripts/moment.js'
  ])
    .pipe(gulp.dest('dist/scripts'));

  var images = gulp.src(['app/images/mountain_outline.svg'])
    .pipe(gulp.dest('dist/images'));

  var amcharts = gulp.src(['app/scripts/amcharts/**/*'])
    .pipe(gulp.dest('dist/scripts/amcharts'));

  var vulcanized = gulp.src(['app/elements/elements.html'])
    .pipe($.rename('elements.vulcanized.html'))
    .pipe(gulp.dest('dist/elements'));

  return merge(app, bower, elements, vulcanized, swBootstrap, swToolbox)
    .pipe($.size({title: 'copy'}));
});

// Copy Web Fonts To Dist
gulp.task('fonts', function () {
  return gulp.src(['app/fonts/**'])
    .pipe(gulp.dest('dist/fonts'))
    .pipe($.size({title: 'fonts'}));
});

// Scan Your HTML For Assets & Optimize Them
gulp.task('html', function () {
  var assets = $.useref.assets({searchPath: ['.tmp', 'dist']});

  return gulp.src(['app/**/*.html', '!app/{elements,test}/**/*.html'])
    // Replace path for vulcanized assets
    .pipe($.if('*.html', $.replace('elements/elements.html', 'elements/elements.vulcanized.html')))
    .pipe(assets)
    // Concatenate And Minify JavaScript
    .pipe($.if('*.js', $.uglify({preserveComments: 'some'}).on('error', function(err) { console.log(err); })))
    // Concatenate And Minify Styles
    // In case you are still using useref build blocks
    .pipe($.if('*.css', $.cssmin()))
    .pipe(assets.restore())
    .pipe($.useref())
    // Minify Any HTML
    .pipe($.if('*.html', $.minifyHtml({
      quotes: true,
      empty: true,
      spare: true
    })))
    // Output Files
    .pipe(gulp.dest('dist'))
    .pipe($.size({title: 'html'}));
});

// Vulcanize imports
gulp.task('vulcanize', function () {
  var DEST_DIR = 'dist/elements';

  return gulp.src('dist/elements/elements.vulcanized.html')
    .pipe($.vulcanize({
      stripComments: true,
      inlineCss: true,
      inlineScripts: true
    }))
    .pipe(gulp.dest(DEST_DIR))
    .pipe($.size({title: 'vulcanize'}));
});

// Generate a list of files that should be precached when serving from 'dist'.
// The list will be consumed by the <platinum-sw-cache> element.
gulp.task('precache', function (callback) {
  var dir = 'dist';

  glob('{elements,scripts,styles}/**/*.*', {cwd: dir}, function(error, files) {
    if (error) {
      callback(error);
    } else {
      files.push('index.html', './', 'bower_components/webcomponentsjs/webcomponents-lite.min.js');
      var filePath = path.join(dir, 'precache.json');
      fs.writeFile(filePath, JSON.stringify(files), callback);
    }
  });
});

// Clean Output Directory
gulp.task('clean', del.bind(null, ['.tmp', 'dist']));

// Watch Files For Changes & Reload
gulp.task('serve', ['styles', 'elements', 'images'], function () {
  browserSync({
    notify: false,
    logPrefix: 'PSK',
    snippetOptions: {
      rule: {
        match: '<span id="browser-sync-binding"></span>',
        fn: function (snippet) {
          return snippet;
        }
      }
    },
    // Run as an https by uncommenting 'https: true'
    // Note: this uses an unsigned certificate which on first access
    //       will present a certificate warning in the browser.
    // https: true,
    server: {
      baseDir: ['.tmp', 'app'],
      middleware: [ historyApiFallback() ],
      routes: {
        '/bower_components': 'bower_components'
      }
    }
  });

  gulp.watch(['app/**/*.html'], ['js', reload]);
  gulp.watch(['app/styles/**/*.css'], ['styles', reload]);
  gulp.watch(['app/elements/**/*.css'], ['elements', reload]);
  gulp.watch(['app/{scripts,elements}/**/*.js'], ['jshint']);
  gulp.watch(['app/images/**/*'], reload);
});

// Build and serve the output from the dist build
gulp.task('serve:dist', ['default'], function () {
  browserSync({
    notify: false,
    logPrefix: 'PSK',
    snippetOptions: {
      rule: {
        match: '<span id="browser-sync-binding"></span>',
        fn: function (snippet) {
          return snippet;
        }
      }
    },
    // Run as an https by uncommenting 'https: true'
    // Note: this uses an unsigned certificate which on first access
    //       will present a certificate warning in the browser.
    // https: true,
    server: 'dist',
    middleware: [ historyApiFallback() ]
  });
  gulp.watch(['app/**/*.html'], ['default', reload]);
  gulp.watch(['app/styles/**/*.css'], ['styles', reload]);
  gulp.watch(['app/elements/**/*.css'], ['elements', reload]);
  gulp.watch(['app/{scripts,elements}/**/*.js'], ['jshint']);
  gulp.watch(['app/images/**/*'], reload);
});

// gulp.task('concat-styles', function () {
//   return gulp.src([
//       '/powercenter/styles/main.css',
//       '/powercenter/styles/dropzone.min.css',
//     ])
//     .pipe(concat('app.css'))
//     .pipe(gulp.dest('dist/styles'));
// });

gulp.task('concat', function () {

  return gulp.src([
      'app/scripts/external.js',
      'dist/scripts/jwt.js',
      'dist/scripts/toolbox.js',
      'dist/scripts/app.js'
    ])
    .pipe(concat('app.min.js'))
    .pipe(gulp.dest('dist/scripts'));
});

// Build Production Files, the Default Task
gulp.task('default', ['clean'], function (cb) {
  runSequence(
    ['copy', 'styles'],
    'jshint',
    ['elements', 'js'],
    ['images', 'fonts', 'html'],
    'vulcanize',
    'concat',
    cb);
    // Note: add , 'precache' , after 'vulcanize', if your are going to use Service Worker
});

// Load tasks for web-component-tester
// Adds tasks for `gulp test:local` and `gulp test:remote`
require('web-component-tester').gulp.init(gulp);

// Load custom tasks from the `tasks` directory
try { require('require-dir')('tasks'); } catch (err) {}
