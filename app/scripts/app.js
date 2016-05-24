/*jshint -W079 */
/*jshint unused:false*/
/*global Dropzone*/
/*global Dexie*/
/*exported mapReadyTrigger, mapReadyEvent*/

/*
processor is a webworker than handles workout fetching.
It requests the data from the API and operates on it
for display.
*/
var processor = new Worker('/powercenter/scripts/processor.js');

Dropzone.autoDiscover = false;

var updatedTime = '';

/*
workoutFetching grabs a workout by ID and
sends the content to workout-element, map-run, and
workout-shared.
{
    id: id of the activity,
    updated_time: a value parsable by new Date()
}
*/
var workoutFetching = function (id, updated_time) {
    processor.postMessage({
        token: jwt.token,
        type: 'workout',
        id: id,
        updated_time: updatedTime
    });
};

var addLog = function (id) {
    processor.postMessage({
        token: jwt.token,
        type: 'addLog',
        id: id
    });
};

var logsFetching = function () {
    processor.postMessage({
        token: jwt.token,
        type: 'all'
    });
};

var suuntoProcessing = function () {
    processor.postMessage({
        token: jwt.token,
        type: 'suuntoProcessing'
    });
};

/*
Creates a local storage database using Dexie.
Items are fetched using ID and the workout data
is stored as JSON in the storage.
Use db.log.clear() to wipe the storage for
testing.
*/
var db;
var initDB = function () {
    db = new Dexie('Logs');
    db.version(1).stores({
        log: '++id, data'
    });
    db.open();
};
initDB();

/*
updateWorkout is a helper function.
It updates the local databases with
new information and updates the server.
{
    id: the id of the activity,
    updates: json object with updates keys and fields,
    cb: callback function for execution on
        server response
}
*/
var updateWorkout = function (id, updates, cb) {
    superagent
        .put(`/b/api/v1/activities/${id}`)
        .send(updates)
        .set('Authorization', `Bearer: ${jwt.token}`)
        .end(cb);

    db.log.get(String(id), function (log) {
        if (log !== undefined) {
            for (var key in updates) {
                log.data[key] = updates[key];
            }
            db.log.put({
                id: String(log.id),
                data: log.data
            });
        }
    });
};

/*
toast is a helper function to set
and display toast messages to user
*/
var toastEle = null;
var toast = function (message) {
    if (toastEle !== null) {
        toastEle.text = message;
        toastEle.show();
    }
};

(function(document) {
    'use strict';

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
        header = document.querySelector('header-element');

        processor.onmessage = (event) => {
            if ('error' in event.data && event.data.error === true) {
                toast('Cannot load workout! Visit the log book to select another.');
                return;
            }
            // If a user is signed in, display the uploader and calendar
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
                workoutElement.setChartData(
                    event.data.chartData,
                    event.data.steps,
                    event.data.chartDescription
                );
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
                console.log(event.data.workoutShared);
                workoutShared.setData(event.data.workoutShared);
            }
        };

        // We use Page.js for routing. This is a Micro
        // client-side router inspired by the Express router
        // More info: https://visionmedia.github.io/page.js/
        page.base('/powercenter');

        page('/', () => {
            if (jwt.hasToken) {
                app.route = 'home';
                header.toggleActive('home');
                suuntoProcessing();
            } else {
                page.redirect('/welcome');
            }
        });

        page('/welcome', () => {
            document.location = '/signin';
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
            header.toggleActive('home');
            app.params = data.params;
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

        page('/plan', () => {
            if (jwt.hasToken) {
                app.route = 'plan';
            } else {
                page.redirect('/welcome');
            }
        });

        page('/plan/:id', (data) => {
            app.route = 'new-plan';
            app.planID = data.params.id;
        });

        page('/a/:name', (data) => {
            if (jwt.hasToken) {
                console.log('user is ', data.params.name);
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
            hashbang: false
        });
        
        var d = document.querySelector('#file');
        this.Dropzone = new Dropzone(d, {
            paramName: 'file', // The name that will be used to transfer the file
            url: '/b/platform/data/stryd',
            headers: {
                'Authorization': `Bearer: ${jwt.token}`
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
})(document);
