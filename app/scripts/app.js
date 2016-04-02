/*jshint -W079 */
/*jshint unused:false*/
/*global Dropzone*/
/*global Dexie*/
/*exported mapReadyTrigger, mapReadyEvent*/

var processor = new Worker('/powercenter/scripts/processor.js');

Dropzone.autoDiscover = false;

var addLog;

var workoutFetching = function (id, updated_time) {
    processor.postMessage({
        token: jwt.token,
        type: 'workout',
        id: id,
        updated_time: updated_time
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
    console.log(id);
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

var toastEle = null;

var toast = function (message) {
    if (toastEle !== null) {
        toastEle.text = message;
        toastEle.show();
    }
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
    var workoutShared;
    var logCalendar;

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
        logCalendar = document.querySelector('log-calendar');
        toastEle = document.querySelector('#toast');

        processor.onmessage = (event) => {
            if ('error' in event.data && event.data.error === true) {
                toast('Cannot load workout! Visit the log book to select another.');
                return;
            }
            if (!jwt.hasToken) {
                logCalendar.classList.add('hidden');
                uploader.classList.add('hidden');
            } else {
                logCalendar.classList.remove('hidden');
                uploader.classList.remove('hidden');
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
                var activityDate = moment.unix(event.data.addLog.start_time);
                toast(`Workout from ${activityDate.format('MMMM Do YYYY')} uploaded!`);
                logBook.addLog(event.data.addLog);
                logCalendar.addActivity(event.data.addLog);
            }
            if ('workoutShared' in event.data) {
                workoutShared.setData(event.data.workoutShared);
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

        page('/connect', () => {
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

            // app.route = 'home';
            // scope = 'shared';
            header.toggleActive('home');
            //app.params = data.params;
            app.route = 'home';
            processor.postMessage({
                token: jwt.token,
                type: 'workout',
                id: data.params.id,
                updated_time: ''
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
                logCalendar.setMode('admin', data.params.name);
                this.displayedTime = moment();
                logCalendar.fetchMonth(
                    this.displayedTime.month(),
                    this.displayedTime.year(),
                    true
                );
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
                addLog(message.activity_id);
            },
            error: function (file, message) {
                toast('Workout could not be uploaded');
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
    window.addLog = function (id) {
        processor.postMessage({
            token: jwt.token,
            type: 'addLog',
            id: id
        });
    };
})(document);