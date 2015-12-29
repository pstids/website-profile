/*jshint -W079 */
/*jshint unused:false*/
/*global Dropzone*/
/*global Dexie*/
/*exported mapReadyTrigger, mapReadyEvent*/

var processor = new Worker('/powercenter/scripts/processor.js');

Dropzone.autoDiscover = false;

var workoutFetching = function (id) {
    processor.postMessage({
        token: jwt.token,
        type: 'workout',
        id: id
    });
};

var db;
var initDB = function () {
    db = new Dexie('Logs');
    db.version(1).stores({
        log: '++id, data'
    });
    db.open();
};
initDB();

var scope = 'owned';

var updateWorkout = function (id, updates, cb) {
    superagent
        .put('/b/api/v1/activities/' + id)
        .send(updates)
        .set('Authorization', 'Bearer: ' + jwt.token)
        .end(cb);
    db.log.get(id, function (log) {
        if (log !== undefined) {
            for (var key in updates) {
                log.data[key] = updates[key];
            }
            db.log.put({
                id: log.id,
                data: log.data
            });
        }
    });
};

(function(document) {
    'use strict';

    // Grab a reference to our auto-binding template
    // and give it some initial binding values
    // Learn more about auto-binding templates at http://goo.gl/Dx1u2g
    let app = document.querySelector('#app');

    var mapRunEle;
    var logBook;
    var workoutElement;
    var header;
    var uploader;

    app.displayInstalledToast = function() {
        document.querySelector('#caching-complete').show();
    };
    // Listen for template bound event to know when bindings
    // have resolved and content has been stamped to the page
    app.addEventListener('dom-change', function() {
        console.log('Stryd is ready to rock!');

        mapRunEle = document.querySelector('#map-run');
        logBook = document.querySelector('#log-book');
        workoutElement = document.querySelector('#workout-element');
        workoutShared = document.querySelector('#workout-shared');
        uploader = document.querySelector('#uploader');

        processor.onmessage = (event) => {
            if ('error' in event.data && event.data.error === true) {
                uploadToast.text = 'Cannot load workout! Visit the log book to select another.';
                uploadToast.show();
                return;
            }
            if (scope === 'shared') {
                logBook.classList.add('hidden');
                uploader.classList.add('hidden');
                workoutShared.classList.remove('hidden');
            } else {
                logBook.classList.remove('hidden');
                uploader.classList.remove('hidden');
                workoutShared.classList.add('hidden');
            }
            if ('mapRunData' in event.data) {
                mapRunEle.setData(event.data.mapRunData);
            }
            if ('chartData' in event.data) {
                workoutElement.setChartData(event.data.chartData, event.data.steps);
            }
            if ('logs' in event.data) {
                logBook.populateLogs(event.data.logs);
            }
            if ('addLog' in event.data) {
                logBook.addLog(event.data.addLog);
            }
            if ('workoutShared' in event.data) {
                workoutShared.setData(event.data.workoutShared);
            }
            // Toggle displays to show 'Sample' messages
            if (event.data.type === 'sample') {
                mapRunEle.classList.add('sample');
                workoutElement.classList.add('sample');
                logBook.classList.add('sample');
                document.querySelector('#sample').show();
            } else {
                mapRunEle.classList.remove('sample');
                workoutElement.classList.remove('sample');
                logBook.classList.remove('sample');
                document.querySelector('#sample').hide();
            }
        };

        header = document.querySelector('header-element');

        // We use Page.js for routing. This is a Micro
        // client-side router inspired by the Express router
        // More info: https://visionmedia.github.io/page.js/
        page.base('/powercenter');

        page('/', () => {
            scope = 'owned';
            if (jwt.hasToken) {
                workoutShared.fetchUser(user.data.user_name);
                logsFetching();
                app.route = 'home';
                header.toggleActive('home');
            } else {
                page.redirect('/welcome');
            }
        });

        page('/welcome', () => {
            document.location = '/signin';
            // app.route = 'welcome';
            // console.log('Welcome to STRYD.');
            // header.toggleActive(null);
        });

        page('/connect', () =>{
            if (jwt.hasToken) {
                app.route = 'connect';
                header.toggleActive('connect');
            } else {
                page.redirect('/welcome');
            }
        });

        page('/users/:name', (data) => {
            app.route = 'user-info';
            app.params = data.params;
        });

        page('/run/:id', (data) => {
            console.log('Trying to load workout.');
            app.route = 'home';
            scope = 'shared';
            header.toggleActive(null);
            app.params = data.params;
            workoutShared.fetchUser(data.params.name);
            processor.postMessage({
                token: jwt.token,
                type: 'workout-view',
                id: data.params.id
            });
        });

        page('/settings', () => {
            if (jwt.hasToken) {
                app.route = 'settings';
                header.toggleActive('settings');
            } else {
                page.redirect('/welcome');
            }
        });

        page('/a/:name', (data) => {
            if (jwt.hasToken) {
                console.log('user is ' + data.params.name);
                app.route = 'home';
                processor.postMessage({
                    token: jwt.token,
                    type: 'admin',
                    user: data.params.name
                });
            } else {
                page.redirect('/welcome');
            }
        });

        page('*', () => {
            document.location = '/signin';
            app.route = '*';
        });

        // add #! before urls
        page({
            hashbang: false,
        });

        var uploadToast = document.querySelector('#upload-toast');
        var d = document.querySelector('#file');
        this.Dropzone = new Dropzone(d, {
            paramName: 'file', // The name that will be used to transfer the file
            url: '/b/platform/data/stryd',
            headers: {
                'Authorization': 'Bearer: ' + jwt.token
            },
            parallelUploads: 1,
            maxFilesize: 60, // MB
            acceptedFiles: '.fit,.tcx,.offline',
            uploadMultiple: false,
            addRemoveLinks: true,
            dictDefaultMessage: 'Drop your FIT file here to upload (Or click to select from computer)',
            dictInvalidFileType: 'File type is not supported. Please upload valid sports watch data file.',
            accept: function (file, done) {
                done();
            },
            success: function (file, message) {
                uploadToast.text = 'Workout uploaded!';
                uploadToast.show();
                addLog(message.activity_id);
            },
            error: function (file, message) {
                uploadToast.text = message.message;
                uploadToast.show();
            },
            sending: function (file, xhr, formData) {
                var uid = new Date().getUTCMilliseconds();
                var fileMetaData = {
                    sizeInBytes: file.size,
                    uploadId: String(uid),
                    md5: '',
                    oauthToken: jwt.token,
                    privacy: 'public',
                    activityIds: [1]
                };
                formData.append('uploadMetaData', JSON.stringify(fileMetaData));
            }
        });
    });

    app.logout = function() {
        jwt.logout();
    };

    // Close drawer after menu item is selected if drawerPanel is narrow
    app.onMenuSelect = function() {
        var drawerPanel = document.querySelector('#paperDrawerPanel');
        if (drawerPanel.narrow) {
            drawerPanel.closeDrawer();
        }
    };

    window.addEventListener('WebComponentsReady', function() {
        var db = new Dexie('Logs');
        db.version(1).stores({
            log: '++id, data'
        });
        db.open();
    });

    var sampleFetching = function () {
        processor.postMessage({
            token: jwt.token,
            type: 'sample'
        });
    };
    var logsFetching = function () {
        processor.postMessage({
            token: jwt.token,
            type: 'all'
        });
    };
    var addLog = function (id) {
        processor.postMessage({
            token: jwt.token,
            type: 'addLog',
            id: id
        });
    };
})(document);