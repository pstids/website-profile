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

    db.log.get(String(id), (log) => {
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

var featureManagement;

(function (document) {
    'use strict';

    let app = document.querySelector('#app');

    var mapRunEle;
    var workoutElement;
    var header;
    var uploader;
    var workoutShared;
    var logCalendar;
    var performanceChart;
    var planView;
    var settingsElement;

    app.displayInstalledToast = function() {
        document.querySelector('#caching-complete').show();
    };
    // Listen for template bound event to know when bindings
    // have resolved and content has been stamped to the page
    app.addEventListener('dom-change', function() {
        mapRunEle = document.querySelector('#map-run');
        workoutElement = document.querySelector('#workout-element');
        workoutShared = document.querySelector('#workout-shared');
        uploader = document.querySelector('#uploader');
        logCalendar = document.querySelector('log-calendar');
        performanceChart = document.querySelector('performance-chart');
        toastEle = document.querySelector('#toast');
        header = document.querySelector('header-element');
        planView = document.querySelector('plan-view');
        settingsElement = document.querySelector('stryd-settings');

        window.mapReady = function () {
            mapRunEle.setReady();
        };
        var wcPoly = document.createElement('script');
        wcPoly.src = 'https://maps.googleapis.com/maps/api/js?key=AIzaSyC-D84ZWKQT9kbZ8meKUu1yvklQUtWRiOg&callback=mapReady';
        document.body.appendChild(wcPoly);

        console.log('Stryd is ready to rock!');

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
                    event.data.chartDescription,
                    event.data.availableMetrics
                );
                planView.setStartTime(event.data.chartDescription.start_time);
            }
            if ('addLog' in event.data) {
                var activityDate = moment.unix(event.data.addLog.start_time);
                toast(`Workout from ${activityDate.format('MMMM Do YYYY')} uploaded!`);
                logCalendar.addActivity(event.data.addLog);
            }
            if ('workoutShared' in event.data) {
                workoutShared.setData(event.data.workoutShared);
            }
        };

        var firstLoad = function () {
            logCalendar.setMode('user', '');
            performanceChart.setMode('user', '');
            suuntoProcessing();
        };
        firstLoad();

        // More info: https://visionmedia.github.io/page.js/
        page.base('/powercenter');

        page('/', () => {
            if (jwt.hasToken) {
                app.route = 'home';
                header.toggleActive('home');
                var now = moment();
                if (featureManagement.hasFeatures) {
                    logCalendar.fetchMonth(
                        now.month(),
                        now.year(),
                        false
                    );
                    page('/analysis');
                } else {
                    logCalendar.fetchMonth(
                        now.month(),
                        now.year(),
                        true
                    );
                }
                if (!logCalendar.hasLoaded && logCalendar.lastActivity !== null) {
                    logCalendar.loadLast(true, logCalendar.lastActivity);
                }
            } else {
                document.location = '/signin';
            }
        });

        page('/analysis', () => {
            if (jwt.hasToken) {
                app.route = 'profile';
                header.toggleActive('profile');
            } else {
                document.location = '/signin';
            }
        });

        page('/connect', () => {
            if (jwt.hasToken) {
                app.route = 'connect';
                header.toggleActive('connect');
            } else {
                document.location = '/signin';
            }
        });

        page('/users/:name', (data) => {
            app.route = 'user-info';
            app.params = data.params;
        });

        page('/run/:id', (data) => {
            mapRunEle.classList.remove('hidden');
            workoutShared.classList.remove('hidden');
            workoutElement.classList.remove('hidden');
            planView.chartToggle(false);
            planView.classList.remove('hasWorkout');

            header.toggleActive('home');
            app.params = data.params;
            app.route = 'home';
            processor.postMessage({
                token: jwt.token,
                type: 'workout',
                id: data.params.id,
                updated_time: updatedTime
            });
        });

        page('/training/:hash', (data) => {
            header.toggleActive('home');
            app.params = data.params;
            app.route = 'home';

            mapRunEle.classList.add('hidden');
            workoutShared.classList.add('hidden');
            workoutElement.classList.add('hidden');
            planView.chartToggle(true);
            planView.setStartHash(data.params.hash);
            planView.classList.add('hasWorkout');
        });

        page('/settings', () => {
            if (jwt.hasToken) {
                app.route = 'settings';
                header.toggleActive('settings');
            } else {
                document.location = '/signin';
            }
        });

        page('/zones', () => {
            if (jwt.hasToken) {
                app.route = 'settings';
                header.toggleActive('settings');
                settingsElement.toggle('zone');
                settingsElement.route = 'zone';
            } else {
                document.location = '/signin';
            }
        });

        page('/plan', () => {
            if (jwt.hasToken) {
                app.route = 'plan';
            } else {
                document.location = '/signin';
            }
        });

        page('/plan/:id', (data) => {
            app.route = 'new-plan';
            app.planID = data.params.id;
        });

        page('/plan/:id/detail', (data) => {
            app.route = 'plan-detail';
            app.planID = data.params.id;
        });

        page('/a/:name', (data) => {
            if (jwt.hasToken) {
                app.route = 'home';
                logCalendar.setMode('admin', data.params.name);
                performanceChart.setMode('admin', data.params.name);
                var now = moment();
                logCalendar.fetchMonth(
                    now.month(),
                    now.year(),
                    true
                );
            } else {
                document.location = '/signin';
            }
        });

        page('*', () => {
            document.location = '/signin';
        });

        featureManagement = new FeatureManagement();

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
            accept: (file, done) => {
                done();
            },
            success: (file, message) => {
                console.log('Success: Added workout');
                addLog(message.activity_id);
            },
            error: (file, message) => {
                toast('Workout could not be uploaded');
            },
            sending: (file, xhr, formData) => {
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
