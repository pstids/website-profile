/*jshint -W079 */
/*jshint unused:false*/
/*global Dropzone*/
/*global Dexie*/

/*
processor is a webworker than handles workout fetching.
It requests the data from the API and operates on it
for display.
*/
var processor = new Worker('/powercenter/scripts/processor.js');

var updatedTime = '';

Dropzone.autoDiscover = false;

/*
workoutFetching grabs a workout by ID and
sends the content to workout-element, map-run, and
workout-shared.
{
    id: id of the activity,
    updated_time: a value parsable by new Date()
}
*/
var workoutFetching = function (id) {
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

var lapProcessing = function (id, lapMarker) {
    processor.postMessage({
        type: 'laps',
        activityID: id,
        lapMarker: lapMarker,
        zones: user.data.training_info.training_zones
    });
};

/*
Creates a local storage database using Dexie.
Items are fetched using ID and the workout data
is stored as JSON in the storage.
Use db.log.clear() to wipe the storage for
testing.
*/
var db, initDB = function () {
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
var toastEle = null, toast = function (message) {
    if (toastEle !== null) {
        toastEle.text = message;
        toastEle.show();
    }
};

var app = document.querySelector('#app');

var mapRunEle,
    workoutElement,
    header,
    uploader,
    logCalendar,
    planView,
    settingsElement,
    rssPrimary,
    rssSecondary,
    bubbleStats,
    homeNavigation,
    lapOverview,
    workoutSummary,
    bubbleStats;

var firstLoad = true;
var currentID = null;

// Listen for template bound event to know when bindings
// have resolved and content has been stamped to the page
app.addEventListener('dom-change', () => {
    console.log('Stryd is ready to rock!');

    homeNavigation = document.querySelector('home-navigation');
    mapRunEle = document.querySelector('#map-run');
    workoutElement = document.querySelector('#workout-element');
    uploader = document.querySelector('#uploader');
    logCalendar = document.querySelector('log-calendar');
    toastEle = document.querySelector('#toast');
    header = document.querySelector('header-element');
    planView = document.querySelector('plan-view');
    settingsElement = document.querySelector('stryd-settings');
    bubbleStats = document.querySelector('bubble-stats');
    rssPrimary = document.querySelector('#rss-primary');
    rssSecondary = document.querySelector('#rss-secondary');
    lapOverview = document.querySelector('lap-overview');
    workoutSummary = document.querySelector('workout-summary');
    bubbleStats = document.querySelector('bubble-stats');

    app.logOption = document.querySelector('log-options');

    app.home = 'analysis';
    app.route = 'profile';

    window.mapReady = function () {
        mapRunEle.setReady();
    };
    var mapScript = document.createElement('script');
    mapScript.src = 'https://maps.googleapis.com/maps/api/js?key=AIzaSyC-D84ZWKQT9kbZ8meKUu1yvklQUtWRiOg&callback=mapReady';
    mapScript.async = true;
    mapScript.defer = true;
    document.body.appendChild(mapScript);

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
        if ('chartDescription' in event.data) {
            lapOverview.getLaps(event.data.chartDescription.id);
        }
        if ('chartData' in event.data) {
            app.calcMetrics(
                0,
                0,
                event.data.chartDescription.id,
                user.data.units
            );
            workoutElement.setChartData(
                event.data.chartData,
                event.data.chartDescription,
                event.data.availableMetrics
            );
            workoutSummary.setData(event.data.workout);
            planView.setStartTime(event.data.chartDescription.start_time);
        }
        if ('addLog' in event.data) {
            var activityDate = moment.unix(event.data.addLog.start_time);
            toast(`Workout from ${activityDate.format('MMMM Do YYYY')} uploaded!`);
            logCalendar.addActivity(event.data.addLog);
        }
        if ('comparison' in event.data) {
            rssPrimary.setChartData(
                event.data.activityPrimary,
                event.data.dataPrimary,
                event.data.maxPower,
                event.data.maxRSS
            );
            rssSecondary.setChartData(
                event.data.activitySecondary,
                event.data.dataSecondary,
                event.data.maxPower,
                event.data.maxRSS
            );
        }
        if ('metrics' in event.data) {
            bubbleStats.setData(event.data.metrics);
        }
        if ('laps' in event.data) {
            lapOverview.displayLaps(event.data.laps);
        }
    };

    suuntoProcessing();

    page.base('/powercenter');

    page('/', () => {
        if (jwt.hasToken) {
            app.route = 'profile';
            header.toggleActive('profile');

            var now = moment();
            logCalendar.fetchMonth(
                now.month(),
                now.year(),
                true
            );
            page('/analysis');
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

    page('/run/:idPrimary/run/:idSecondary', (data) => {
        app.route = 'profile';
        app.params = data.params;
        app.home = 'comparison';
        header.toggleActive('profile');
        homeNavigation.select('comparison');

        processor.postMessage({
            token: jwt.token,
            type: 'workoutComparison',
            params: data.params,
            updated_time: updatedTime
        });
    });

    page('/run/:idPrimary/training/:idSecondary', (data) => {
        app.route = 'profile';
        app.params = data.params;
        app.home = 'analysis';
        header.toggleActive('profile');
        homeNavigation.select('training');

        var planView = document.createElement('plan-view');
        planView.id = 'plan-compliment';
        planView.chartToggle(true);
        planView.setStartHash(data.params.idSecondary);
        planView.classList.add('hasWorkout');

        document.querySelector('[data-analysis]')
            .appendChild(planView);

        workoutFetching(data.params.idPrimary);
    });

    page('/run/:id', (data) => {
        app.route = 'profile';
        app.params = data.params;
        app.home = 'analysis';
        header.toggleActive('profile');
        homeNavigation.select('analysis');

        logCalendar.setActive(app.params.id);
        
        lapOverview.classList.add('hidden');

        mapRunEle.classList.remove('hidden');
        workoutElement.classList.remove('hidden');
        planView.chartToggle(false);
        planView.classList.remove('hasWorkout');

        if (firstLoad) {
            urlManager.setNavigation(app.params.id, 0);
            firstLoad = false;
        } else {
            window.scrollTo(0, document.querySelector('#workout-holder').offsetTop);
        }

        if (currentID !== app.params.id) {
            workoutElement.setLoading();
            workoutFetching(app.params.id);
            currentID = app.params.id;
        }
    });

    page('/training/:hash', (data) => {
        app.params = data.params;
        app.route = 'profile';
        app.home = 'training';
        header.toggleActive('profile');

        window.scrollTo(0, document.querySelector('#workout-holder').offsetTop);

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

    page({
        hashbang: false
    });

    app.dropzone = new Dropzone(
        document.querySelector('#file'),
        {
            paramName: 'file',
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
        }
    );
});

app.logout = function () {
    jwt.logout();
};

app.compare = function (id) {
    var pathParts = location.pathname.split('/');
    pathParts.shift();
    if (pathParts[1] === 'run') {
        page.redirect(`/run/${pathParts[2]}/run/${id}`);
    } else {
        page.redirect(`/run/${id}`);
    }
};

app.calcMetrics = function (start, end, activityID, unit) {
    processor.postMessage({
        type: 'metrics',
        start: start,
        end: end,
        activityID: activityID,
        unit: unit
    });
};

app.setDownload = function (url) {
    document.querySelector('#dlFrame').src = url;
};

app.giveActivities = function (activities) {
    logCalendar.processActivities(activities);
};

app.setHomeNavigation = function (availables) {
    homeNavigation.setAvailable(availables);
};

app.showLaps = function (status) {
    if (!status) {
        lapOverview.classList.add('hidden');
    } else {
        lapOverview.classList.remove('hidden');
    }
};