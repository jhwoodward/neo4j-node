var args = require('yargs').argv;
var browserSync = require('browser-sync');
var config = require('./gulp.config')();
var del = require('del');
var glob = require('glob');
var gulp = require('gulp');
var bower = require('bower');
var path = require('path');
var replace = require('gulp-replace');
var ngConstant = require('gulp-ng-constant');
var lazypipe = require('lazypipe');
var runSeries = require('run-sequence');
var _ = require('lodash');
var exec = require('gulp-exec');
var spawn = require('child_process').spawn;
var protractor = require('gulp-protractor').protractor;
var webdriver = require('gulp-protractor').webdriver;
var $ = require('gulp-load-plugins')({lazy: true});
var exit = require('gulp-exit');
var uglify = require('gulp-uglify');
var sourcemaps = require('gulp-sourcemaps');
var fs = require('fs');
var minimist = require('minimist');
var gulpIf = require('gulp-if');
var colors = $.util.colors;
var env = $.util.env;
var reload = browserSync.reload;

var port = process.env.PORT || config.defaultPort;
var CORE_CSS_PATH = config.temp + 'styles.css';
var nodemon;
var webdriverProcess;
// assume failure by default. Only protractor can set it to success
var errorCode = 1;

process.env.NODE_ENV = 'development';
process.env.BUILD_ENV = 'development';

// clean opened processes if gulp is interrupted with ctrl + c
process.on('exit', _cleanProcesses);
process.on('SIGINT', _cleanProcesses);
process.on('uncaughtException', _cleanProcesses);

/**
 * yargs variables can be passed in to alter the behavior, when present.
 * Example: gulp serve
 *
 * --verbose  : Various tasks will produce more output to the console.
 * --nosync   : Don't launch the browser with browser-sync when serving code.
 * --debug    : Launch debugger with node-inspector.
 * --debug-brk: Launch debugger and break on 1st line with node-inspector.
 * --startServers: Will start servers for midway tests on the test task.
 *
 * To generate sourcemaps for prod ready files use:
 * 'gulp serve-build --sourcemaps' or 'gulp build --sourcemaps'
 *
 * e2e tests:
 * test one file:   npm run test:e2e -- --one=test/creativeSet/creativeSetUpdate.spec.js
 * run all tests:   npm run test:e2e
 *
 * kill background processes:
 * npm run kill
 */

var basicInjector = function(devDep) {
    var options = config.getWiredepDefaultOptions();
    if (devDep) {
        options.devDependencies = true;
    }
    var js = args.stubs ? [].concat(config.js, config.stubsjs) : config.js;
    var templateCache = config.temp + config.templateCache.file;
    var wiredep = require('wiredep').stream;

    return lazypipe()
        .pipe(function() {
            return gulpIf(process.env.BUILD_ENV === 'development', injectCSS());
        })
        .pipe(wiredep, options)
        .pipe(inject, templateCache, 'templates')
        .pipe(inject, js, '', config.jsOrder);
};

gulp.task('default', ['compile-core-css', 'templatecache'], function() {
    var fileInject = basicInjector();
    return gulp
        .src(config.client + config.indexTemplate) //indexTemplate
        .pipe(fileInject())
        .pipe($.rename(config.indexFile))
        .pipe(gulp.dest(config.client));
});

gulp.task('webserver', function() {
    var nodeOptions = {
        script: './src/server/app.js',
        delayTime: 1,
        ignore: ['*.*'],
        quiet: true,
        env: { PORT: '4000', SILENT: true }
    };

    nodemon = $.nodemon(nodeOptions);
});

/**
 * Optimize all files, move to a build folder, and inject them into the new index.html.
 * This function parses the index.tmpl from src/client, takes the file references using useref plugin,
 * minifies and concaternates the css files, annontates and concaternates js files and replaces the references to the
 * files with links to the concaternated files. Finally it adds revisions to concaternated files for cache purging
 * @return {Stream}
 */
gulp.task('optimize', ['default', 'fonts', 'images', 'csvTemplates'], function() {
    log('Optimizing the js, css, and html');
    var assets = $.useref.assets({searchPath: './'});
    // Filters are named for the gulp-useref path
    var cssFilter = $.filter('**/*.css');
    var jsAppFilter = $.filter('**/app.js');
    var jslibFilter = $.filter('**/lib.js');
    var templateCache = config.temp + config.templateCache.file;
    return gulp
        .src(config.client + config.indexFile)
        .pipe($.plumber()) // ensures we don't unpipe streams on errors
        .pipe(assets) // Gather all assets from the html with useref
        .pipe(cssFilter) // Get the css
        .pipe($.csso())
        .pipe(cssFilter.restore())
        .pipe(jsAppFilter) // Get the custom javascript
        .pipe($.ngAnnotate())
        // Only uglify if we don't need to generate sourcemaps. If we do then it's done in the post-optimize task
        //.pipe(gulpIf(!args.sourcemaps, uglify()))
        .pipe(getHeader())
        .pipe(jsAppFilter.restore())
        .pipe(jslibFilter)
        .pipe(uglify())
        .pipe(jslibFilter.restore())
        .pipe($.rev()) // Take inventory of the file names for future rev numbers
        .pipe(assets.restore()) // Apply the concat and file replacement with useref
        .pipe($.useref())
        .pipe($.revReplace()) // Replace the file names in the html with rev numbers
        .pipe(gulp.dest(config.build));
});

gulp.task('update-bullseye-style', function() {
    return bower.commands.update(['bullseye-style'], {}, {})
    .on('end', function(result) {
        log('updated bullseye-style');
    });
});
/**
 * Uglifies and generates the sourcemap for the concaternated app js file resulted from the optimize task
 * @return {Stream}
 */
gulp.task('post-optimize', [], function() {
    return gulp.src(config.build + 'js/app*.js')
        .pipe(sourcemaps.init())
        .pipe(uglify())
        .pipe(sourcemaps.write('.'))
        .pipe(gulp.dest(config.build + 'js'));
});

/**
 * Generate build directory that can be archived and deployed
 */
gulp.task('build', function(done) {
    process.env.BUILD_ENV = 'build';
    var runSeriesTasks = [
        ['build-config-files', 'optimize'],
        done
    ];
    // Only run post-optimize if we receive the --sourcemaps flag in the gulp command
    if (args.sourcemaps) {
        // Insert post-optimize to run after 'optimize' task completes
        runSeriesTasks.splice(runSeriesTasks.length - 1, 0, 'post-optimize');
    }
    runSeries.apply(null, runSeriesTasks);
});

/**
 * List the available gulp tasks
 */
gulp.task('help', $.taskListing);

/**
 * vet the code and create coverage report
 * @return {Stream}
 */
gulp.task('vet', function(done) {
    log('Analyzing source with JSHint and JSCS');

    return runSeries('jshint', 'jscs', done);
});

gulp.task('jscs', function() {
    var src;
    var knownOptions = {
        string: ['one'],
        default: {one:''}
    };

    var options = minimist(process.argv.slice(2), knownOptions);
    var name = options.one;

    if (name) {
        src = ['./src/client/app/' + name + '/**/*.js'];
    } else {
        src = config.alljs;
    }

    return gulp
        .src(src)
        .pipe($.if(args.verbose, $.print()))
        .pipe($.jscs());
});

gulp.task('jshint', function() {
    var src;
    var knownOptions = {
        string: ['one'],
        default: {one:''}
    };

    var options = minimist(process.argv.slice(2), knownOptions);
    var name = options.one;

    if (name) {
        src = ['./src/client/app/' + name + '/**/*.js'];
    } else {
        src = config.alljs;
    }

    return gulp
        .src(src)
        .pipe($.if(args.verbose, $.print()))
        .pipe($.jshint())
        .pipe($.jshint.reporter('jshint-stylish', {verbose: true}))
        .pipe($.jshint.reporter('fail'));
});

/**
 * Create a visualizer report
 */
gulp.task('plato', function(done) {
    log('Analyzing source with Plato');
    log('Browse to /report/plato/index.html to see Plato results');

    startPlatoVisualizer(done);
});

/**
 * Compile sass to css
 * @return {Stream}
 */
gulp.task('compile-core-css', ['clean-styles', 'update-bullseye-style'], function() {
    log('Compiling Sass --> CSS');

    return gulp
        .src(config.sassCore)
        .pipe($.plumber({
            errorHandler: function (err) {
                log('Error: ' + $.util.colors.red(err.message));
                log('File: ' + $.util.colors.red(err.fileName));
                log('Line: ' + $.util.colors.red(err.lineNumber));
                this.emit('end');
            }
        }))
        .pipe($.sass({includePaths: ['./bower_components']}))
        .pipe($.autoprefixer({browsers: ['last 2 version', '> 5%']}))
        .pipe(gulp.dest(config.temp))
        .pipe(reload({ stream:true }));
});

/**
 * Compile sass to css in the build directory
 * @return {Stream}
 */
gulp.task('build-core-css', ['update-bullseye-style'], function() {
    log('Compiling Sass --> CSS');

    return gulp
        .src(config.sassCore)
        .pipe($.plumber({
            errorHandler: function (err) {
                log('Error: ' + $.util.colors.red(err.message));
                log('File: ' + $.util.colors.red(err.fileName));
                log('Line: ' + $.util.colors.red(err.lineNumber));
                this.emit('end');
            }
        }))
        .pipe($.sass({includePaths: ['./bower_components']}))
        .pipe($.autoprefixer({browsers: ['last 2 version', '> 5%']}))
        .pipe(gulp.dest(config.build + '/styles'))
        .pipe(reload({ stream:true }));
});

/**
 * Copy fonts
 * @return {Stream}
 */
gulp.task('fonts', ['clean-fonts'], function() {
    log('Copying fonts');

    return gulp
        .src(config.fonts)
        .pipe(gulp.dest(config.build + 'fonts'));
});

/**
 * Compress images
 * @return {Stream}
 */
gulp.task('images', ['clean-images'], function() {
    log('Compressing and copying images');

    return gulp
        .src(config.images)
        .pipe($.imagemin({optimizationLevel: 4}))
        .pipe(gulp.dest(config.build + 'images'));
});

/**
 * Move csv templates
 * @return {Stream}
 */
gulp.task('csvTemplates', ['clean-csvTemplates'], function() {
    log('Copying CSV Templates to build');

    return gulp
        .src(config.csvTemplates)
        .pipe(gulp.dest(config.build + 'csvTemplates'));
});

gulp.task('sass-watcher', function() {
    gulp.watch([config.sass], ['compile-core-css']);
});

/**
 * Create $templateCache from the html templates
 * @return {Stream}
 */
gulp.task('templatecache', ['clean-code'], function() {
    log('Creating an AngularJS $templateCache');

    return gulp
        .src(config.htmltemplates)
        .pipe($.if(args.verbose, $.bytediff.start()))
        .pipe($.minifyHtml({empty: true}))
        .pipe($.if(args.verbose, $.bytediff.stop(bytediffFormatter)))
        .pipe($.angularTemplatecache(
            config.templateCache.file,
            config.templateCache.options
        ))
        .pipe(gulp.dest(config.temp));
});

/**
 * Inject all the spec files into the specs.html
 * @return {Stream}
 */
gulp.task('build-specs', ['templatecache'], function(done) {
    log('building the spec runner');
    var specs = config.specs;
    var fileInject = basicInjector(true);
    if (args.startServers) {
        specs = [].concat(specs, config.serverIntegrationSpecs);
    }
    return gulp
        .src(config.specRunnerPath + 'specs.tmpl')
        .pipe(inject(config.testlibraries, 'testlibraries'))
        .pipe(inject(config.specHelpers, 'spechelpers'))
        .pipe(inject(specs, 'specs', ['**/*']))
        .pipe(fileInject())
        .pipe($.rename(config.specRunnerFile))
        .pipe(gulp.dest(config.specRunnerPath));
});

/**
 * Remove all files from the build, temp, and reports folders
 * @param  {Function} done - callback when complete
 */
gulp.task('clean', function(done) {
    var delconfig = [].concat(config.build, config.temp, config.report);
    delconfig.push(config.client + '*.html');
    delconfig.push(config.clientApp + 'shared/config.module.js');
    log('Cleaning: ' + $.util.colors.blue(delconfig));
    del(delconfig, done);
});

gulp.task('clean-config', function(done) {
    clean(config.build + 'config/**/*.*', function() {
        clean(config.configFolder + '/config.js', done);
    });
});

/**
 * Remove all fonts from the build folder
 * @param  {Function} done - callback when complete
 */
gulp.task('clean-fonts', function(done) {
    clean(config.build + 'fonts/**/*.*', done);
});

/**
 * Remove all images from the build folder
 * @param  {Function} done - callback when complete
 */
gulp.task('clean-images', function(done) {
    clean(config.build + 'images/**/*.*', done);
});

/**
 * Remove all csv templates from the build folder
 * @param  {Function} done - callback when complete
 */
gulp.task('clean-csvTemplates', function(done) {
    clean(config.build + 'csvTemplates/**/*.*', done);
});

/**
 * Remove all styles from the build and temp folders
 * @param  {Function} done - callback when complete
 */
gulp.task('clean-styles', function(done) {
    var files = [].concat(
        config.temp + '**/*.css',
        config.build + 'styles/**/*.css'
    );
    clean(files, done);
});

/**
 * Remove all js and html from the build and temp folders
 * @param  {Function} done - callback when complete
 */
gulp.task('clean-code', function(done) {
    var files = [].concat(
        config.temp + '**/*.js',
        config.build + 'js/**/*.js',
        config.build + '**/*.html'
    );
    clean(files, done);
});

/**
 * Run specs for each folder and exit
 * To start servers and run midway specs as well:
 *    gulp test --startServers
 *    gulp test --one <folder> to run test on only 1 folder.
 * @return {Stream}
 */
gulp.task('test', ['vet'], function(done) {
    var knownOptions = {
        string: ['one'],
        default: {one:''}
    };

    var options = minimist(process.argv.slice(2), knownOptions);

    var name = options.one;
    if (name === '') {
        runSeries('templatecache', 'build-config-files', startSplitTests.bind(null, done));
    } else {
        var folder = [];
        folder.push(name);
        runSeries('templatecache', 'build-config-files', startFolderTests.bind(null, folder, done));
    }
});

/**
 * Run specs once and exit
 * To start servers and run midway specs as well:
 *    gulp test --startServers
 * @return {Stream}
 */
gulp.task('test-coverage', function(done) {
    runSeries('templatecache', 'build-config-files', 'vet', startTestCoverage.bind(null, true, done));
});

/**
 * Run the spec runner
 * @return {Stream}
 */
gulp.task('serve-specs', [], function() {
    log('run the spec runner');
    return runSeries('build-specs', 'build-config-files', serve.bind(null, false, true));
    //serve(false, true);
});

/**
 * serve the dev environment
 * --debug-brk or --debug
 * --nosync
 */
gulp.task('serve', [], function() {
    process.env.BUILD_ENV = 'development';
    return runSeries('default', 'build-config-files', serve.bind(null, false));
});

// TODO: what is this for?
gulp.task('close', [], function() {});

/**
 * serve the build environment
 * --debug-brk or --debug
 * --nosync
 */
gulp.task('serve-build', [], function() {
    process.env.NODE_ENV = 'build';
    CORE_CSS_PATH = 'styles/styles.css';
    return runSeries('build', 'build-core-css', serve.bind(null, true));
});

/**
 * Bump the version
 * --type=pre will bump the prerelease version *.*.*-x
 * --type=patch or no flag will bump the patch version *.*.x
 * --type=minor will bump the minor version *.x.*
 * --type=major will bump the major version x.*.*
 * --version=1.2.3 will bump to a specific version and ignore other flags
 */
gulp.task('bump', function() {
    var msg = 'Bumping versions';
    var type = args.type;
    var version = args.ver;
    var options = {};
    if (version) {
        options.version = version;
        msg += ' to ' + version;
    } else {
        options.type = type;
        msg += ' for a ' + type;
    }
    log(msg);

    return gulp
        .src(config.packages)
        .pipe($.print())
        .pipe($.bump(options))
        .pipe(gulp.dest(config.root));
});

/**
 * Add config files (we have many, need to find better names for all of them) to build directory
 */
gulp.task('build-config-files', ['template-config-files'], function() {
    return gulp
        .src(config.configFolder + '/*.js')
        .pipe(gulp.dest(config.build + 'config'));
});

/**
 * Create config.js file that picks up environment variables
 *
 * Currently used to set up a config that can be used by Jenkins more
 * easily than the shell-script that is currently being run to generate it.
 */
gulp.task('template-config-files', function() {
    var bullseyeApiBaseUrl = process.env['BULLSEYE_API_BASE_URL'] || config.defaultBullseyeApiBaseUrl;
    var bullseyeApiDomain = process.env['BULLSEYE_API_DOMAIN'] || config.defaultBullseyeApiDomain;
    var coreCssPath = process.env['CORE_CSS_PATH'] || CORE_CSS_PATH;
    var devEnv = process.env['BULLSEYE_UI_DEV_ENV'] || 'false';

    return gulp.src(config.configFolder + '/config.js.template')
        .pipe(replace(/%BULLSEYE_API_BASE_URL%/g, bullseyeApiBaseUrl))
        .pipe(replace(/%BULLSEYE_API_DOMAIN%/g, bullseyeApiDomain))
        .pipe(replace(/%CORE_CSS_PATH%/g, coreCssPath))
        .pipe(replace(/%BULLSEYE_UI_DEV_ENV%/g, devEnv))
        .pipe($.rename('config.js'))
        .pipe(gulp.dest(config.configFolder));
});

gulp.task('webdriver', function(done) {
    var serverStartedMessage = 'Selenium Server is up and running';
    webdriverProcess = spawn('npm', ['run', 'test:e2e:webdriver'], {detached: true});

    webdriverProcess.stderr.on('data', _log);
    webdriverProcess.stdout.on('data', _log);

    var failTimeout = setTimeout(function () {
        log(colors.yellow('Webdriver failed to start. Using the existing instance.' +
            '\nAlternatively you can kill it with \'npm run kill\''));
        webdriverProcess = undefined;
        done();
    }, 5000);

    function _log(data) {
        data = data.toString();
        // detects when webdriver is ready
        if (data.indexOf(serverStartedMessage) !== -1) {
            log(colors.yellow('Webdriver started'));
            clearTimeout(failTimeout);
            done();
        }
    }
});

/**
 * This is intended to be used locally and will run the dev files which can be debugged easily.
 */
gulp.task('e2e:dev', function(done) {
    process.env.NODE_ENV = 'development';
    CORE_CSS_PATH = config.temp + 'styles.css';

    return runSeries('default', 'build-config-files', 'webserver', 'webdriver', _runTests.bind(null, done));
});

/**
 * This is intended to be used locally and will run the build files (live prepared files).
 */
gulp.task('e2e:build', function(done) {
    process.env.NODE_ENV = 'build';
    CORE_CSS_PATH = 'styles/styles.css';

    return runSeries('build', 'build-core-css', 'webserver', 'webdriver', _runTests.bind(null, done));
});

/**
 * This is intended to be used on the jenkins CI server.
 */
gulp.task('e2e:jenkins', function(done) {
    process.env.NODE_ENV = 'build';
    CORE_CSS_PATH = 'styles/styles.css';

    return runSeries('build', 'build-core-css', 'webserver', _runTests.bind(null, done));
});

/**
 * This is intended to be used on the jenkins CI server running the unminified code
 */
gulp.task('e2e:jenkins-dev', function(done) {
    process.env.NODE_ENV = 'development';
    CORE_CSS_PATH = config.temp + 'styles.css';

    return runSeries('default', 'build-config-files', 'webserver', _runTests.bind(null, done));
});

function _runTests(done) {
    var e2eRoot = './src/client/integration';
    var sourcePath = path.join(e2eRoot, 'test/**/*.spec.js');

    if (args.one) {
        sourcePath = path.join(e2eRoot, args.one);
    }

    var specs = [
        path.join(e2eRoot, 'test/**/login.spec.js'),
        path.join(e2eRoot, 'test/**/accountCreate.spec.js'),
        path.join(e2eRoot, 'test/**/accountList.spec.js'),
        path.join(e2eRoot, 'test/**/campaignList.spec.js'),
        path.join(e2eRoot, 'test/**/campaignCreate.spec.js'),
        path.join(e2eRoot, 'test/**/lineItemMain.spec.js'),
        path.join(e2eRoot, 'test/**/lineItemDelivery.spec.js'),
        path.join(e2eRoot, 'test/**/lineItemSidebar.spec.js'),
        path.join(e2eRoot, 'test/**/trackersList.spec.js'),
        path.join(e2eRoot, 'test/**/trackerEdit.spec.js'),
        path.join(e2eRoot, 'test/**/filter.spec.js')
        //sourcePath
    ];

    gulp.src(specs)
        .pipe(protractor({
            configFile: './protractor.config.js'
        }))
        .on('error', function (err) {
            done();
            errorCode = err;
            _cleanProcesses();
        })
        .on('end', function () {
            done();
            errorCode = 0;
            _cleanProcesses();
        });
}

/**
 * When files change, log it
 * @param  {Object} event - event that fired
 */
function changeEvent(event) {
    var srcPattern = new RegExp('/.*(?=/' + config.source + ')/');
    log('File ' + event.path.replace(srcPattern, '') + ' ' + event.type);
}

/**
 * Delete all files in a given path
 * @param  {Array}   path - array of paths to delete
 * @param  {Function} done - callback when complete
 */
function clean(path, done) {
    log('Cleaning: ' + $.util.colors.blue(path));
    del(path, done);
}

/**
 * Inject files in a sorted sequence at a specified inject label
 * @param   {Array} src   glob pattern for source files
 * @param   {String} label   The label name
 * @param   {Array} order   glob pattern for sort order of the files
 * @returns {Stream}   The stream
 */
function inject(src, label, order) {
    var options = { read: false };
    if (label) { options.name = 'inject:' + label; }

    return $.inject(orderSrc(src, order), options);
}

function injectCSS() {
    var options = { read: false };
    return $.inject(orderSrc(config.css), options);
}

/**
 * Order a stream
 * @param   {Stream} src   The gulp.src stream
 * @param   {Array} order Glob array pattern
 * @returns {Stream} The ordered stream
 */
function orderSrc (src, order) {
    //order = order || ['**/*'];
    return gulp
        .src(src)
        .pipe($.if(order, $.order(order)));
}

/**
 * serve the code
 * --debug-brk or --debug
 * --nosync
 * @param  {Boolean} runningBuild - dev or build mode
 * @param  {Boolean} specRunner - server spec runner html
 */
function serve(runningBuild, specRunner) {
    var debug = args.debug || args.debugBrk;
    var debugMode = args.debug ? '--debug' : args.debugBrk ? '--debug-brk' : '';
    var nodeOptions = getNodeOptions();

    if (debug) {
        runNodeInspector();
        nodeOptions.nodeArgs = [debugMode + '=5858'];
    }

    if (args.verbose) {
        console.log(nodeOptions);
    }

    return $.nodemon(nodeOptions)
        .on('restart', ['vet'], function(ev) {
            log('*** nodemon restarted');
            log('files changed:\n' + ev);
            setTimeout(function() {
                browserSync.notify('reloading now ...');
                browserSync.reload({stream: false});
            }, config.browserReloadDelay);
        })
        .on('start', function () {
            log('*** nodemon started');
            startBrowserSync(runningBuild, specRunner);
        })
        .on('crash', function () {
            log('*** nodemon crashed: script crashed for some reason');
        })
        .on('exit', function () {
            log('*** nodemon exited cleanly');
            browserSync.exit();
        });
}

function getNodeOptions() {
    return {
        script: config.nodeServer,
        delayTime: 1,
        env: {
            'PORT': port,
            'NODE_ENV': process.env.NODE_ENV === 'development' ? 'dev' : 'build'
        },
        watch: [config.server]
    };
}

function runNodeInspector() {
    log('Running node-inspector.');
    log('Browse to http://localhost:8080/debug?port=5858');
    var exec = require('child_process').exec;
    exec('node-inspector');
}

/**
 * Start BrowserSync
 * --nosync will avoid browserSync
 */
function startBrowserSync(runningBuild, specRunner) {
    if (args.nosync || browserSync.active) {
        return;
    }

    log('Starting BrowserSync on port ' + port);

    // If build: watches the files, builds, and restarts browser-sync.
    // If dev: watches sass, compiles it to css, browser-sync handles reload
    if (!runningBuild) {
        gulp.watch([config.sass], ['compile-core-css']).on('change', changeEvent);
        gulp.watch([config.html], ['templatecache']).on('change', changeEvent);
    } else {
        gulp.watch([config.sass, config.js, config.html], ['build', 'build-core-css', reload])
            .on('change', changeEvent);
    }
    startServer(runningBuild, specRunner);
}
function startServer(runningBuild, specRunner) {
    var options = {
        proxy: 'localhost:' + port,
        port: 4000,
        files: !runningBuild ? [
            config.client + '**/*.*',
            config.temp + '**/*.css',
            '!' + config.sass
        ] : [],
        ghostMode: false,
        injectChanges: true,
        logFileChanges: true,
        logLevel: 'debug',
        logPrefix: 'gulp-patterns',
        notify: true,
        reloadDelay: 0 //1000
    } ;
    if (specRunner) {
        options.startPath = config.specRunnerPath + config.specRunnerFile;
    }

    return browserSync(options);
}

/**
 * Start Plato inspector and visualizer
 */
function startPlatoVisualizer(done) {
    log('Running Plato');

    var files = glob.sync(config.plato.js);
    var excludeFiles = /.*\.spec\.js/;
    var plato = require('plato');

    var options = {
        title: 'Plato Inspections Report',
        exclude: excludeFiles
    };
    var outputDir = config.report + '/plato';

    plato.inspect(files, outputDir, options, platoCompleted);

    function platoCompleted(report) {
        var overview = plato.getOverviewReport(report);
        if (args.verbose) {
            log(overview.summary);
        }
        if (done) { done(); }
    }
}

function getFolders(dir) {
    return fs.readdirSync(dir)
        .filter(function(file) {
            return fs.statSync(path.join(dir, file)).isDirectory();
        });
}

function startFolderTests(dir, done) {
    var folder = dir.shift();
    var specs = './src/client/specs/' + folder + '/**/*.js';
    var testFiles = [].concat(config.karma.files, specs, [config.configFolder + '/config.js']); // keep config.js last
    var serverSpecs = config.serverIntegrationSpecs;

    var Karma = require('karma').Server;
    var karmConfig = {
        configFile: __dirname + '/karma.conf.js',
        exclude: serverSpecs,
        files: testFiles,
        singleRun: true,
        reporters: config.karma.reporters,
        coverageReporter: config.karma.coverage
    };
    var server = new Karma(karmConfig, karmaCompleted);

    log('Starting tests for ' + folder);
    server.start();

    function karmaCompleted(karmaResult) {
        if (karmaResult === 0) {
            if (dir.length) {
                startFolderTests(dir, done);
            } else {
                log('Karma completed');
                done();
            }
        } else {
            done('karma: tests failed with code ' + karmaResult);
        }
    }
}

/**
 * Start the split tests using karma.
 * @param  {Function} done - Callback to fire when karma is done
 * @return {undefined}
 */
function startSplitTests(done) {
    var specDir = getFolders('./src/client/specs/');
    startFolderTests(specDir, done);
}

/**
 * Get coverage report from the tests.
 * @param  {Function} done - Callback to fire when karma is done
 * @return {undefined}
 */
function startTestCoverage(done) {
    var knownOptions = {
        boolean: ['extended'],
        default: {extended: false}
    };

    var options = minimist(process.argv.slice(2), knownOptions);
    var extended = options.extended;

    var Karma = require('karma').Server;
    var specs = './src/client/specs/**/*.js';
    var serverSpecs = config.serverIntegrationSpecs;
    var testFiles = [].concat(config.karma.files, specs, [config.configFolder + '/config.js']);
    var karmConfig = {
        configFile: __dirname + '/karma.conf.js',
        exclude: serverSpecs,
        files: testFiles,
        singleRun: true,
        reporters: extended ? config.karma.mochaReporter : config.karma.reporters,
        coverageReporter: config.karma.coverage,
        browserDisconnectTimeout: 10000,
        browserNoActivityTimeout: 10000,
        preprocessors: {
            './src/client/app/**/*.js': ['coverage']
        },
        client: {
            mocha: {
                timeout : 10000
            }
        }
    };
    var server = new Karma(karmConfig, karmaCompleted);

    server.start(config, karmaCompleted);

    ////////////////

    function karmaCompleted(karmaResult) {
        if (karmaResult === 1) {
            done('karma: tests failed with code ' + karmaResult);
        } else {
            log('Karma test coverage completed');
            done();
        }
    }
}

/**
 * Formatter for bytediff to display the size changes after processing
 * @param  {Object} data - byte data
 * @return {String}      Difference in bytes, formatted
 */
function bytediffFormatter(data) {
    var difference = (data.savings > 0) ? ' smaller.' : ' larger.';
    return data.fileName + ' went from ' +
        (data.startSize / 1000).toFixed(2) + ' kB to ' +
        (data.endSize / 1000).toFixed(2) + ' kB and is ' +
        formatPercent(1 - data.percent, 2) + '%' + difference;
}
/**
 * Log an error message and emit the end of a task
 */
function errorLogger(error) {
    log('*** Start of Error ***');
    log(error);
    log('*** End of Error ***');
    this.emit('end');
}

/**
 * Format a number as a percentage
 * @param  {Number} num       Number to format as a percent
 * @param  {Number} precision Precision of the decimal
 * @return {String}           Formatted perentage
 */
function formatPercent(num, precision) {
    return (num * 100).toFixed(precision);
}

/**
 * Format and return the header for files
 * @return {String}           Formatted file header
 */
function getHeader() {
    var pkg = require('./package.json');
    var template = ['/**',
                    ' * <%= pkg.name %> - <%= pkg.description %>',
                    ' * @authors <%= pkg.authors %>',
                    ' * @version v<%= pkg.version %>',
                    ' * @link <%= pkg.homepage %>',
                    ' * @license <%= pkg.license %>',
                    ' */',
                    ''
                   ].join('\n');
    return $.header(template, {
        pkg: pkg
    });
}

/**
 * Log a message or series of messages using chalk's blue color.
 * Can pass in a string, object or array.
 */
function log(msg) {
    if (typeof(msg) === 'object') {
        for (var item in msg) {
            if (msg.hasOwnProperty(item)) {
                $.util.log($.util.colors.blue(msg[item]));
            }
        }
    } else {
        $.util.log($.util.colors.blue(msg));
    }
}

/**
 * Show OS level notification using node-notifier
 */
function notify(options) {
    var notifier = require('node-notifier');
    var notifyOptions = {
        sound: 'Bottle',
        contentImage: path.join(__dirname, 'gulp.png'),
        icon: path.join(__dirname, 'gulp.png')
    };
    _.assign(notifyOptions, options);
    notifier.notify(notifyOptions);
}

/**
 * Kill child processes
 * @method _cleanProcesses
 */
function _cleanProcesses() {
    var processesToWaitFor = 0;
    var closedProcesses = 0;

    try {
        nodemon.on('exit', _exit);
        processesToWaitFor += 1;
    } catch (e) {}

    try {
        webdriverProcess.on('exit', _exit);
        processesToWaitFor += 1;
    } catch (e) {}

    try {
        process.kill(-webdriverProcess.pid);
    } catch (e) {}

    try {
        nodemon.emit('quit');
    } catch (e) {}

    function _exit() {
        closedProcesses += 1;

        if (closedProcesses === processesToWaitFor) {

            process.exit(errorCode);
        }
    }
}

module.exports = gulp;
