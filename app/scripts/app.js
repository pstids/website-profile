/*jshint -W079 */
/*jshint unused:false*/
/*jshint -W079 */
/*global Dropzone*/
/*global jwt*/

var processor = new Worker('/powercenter/scripts/processor.js');

var workoutFetching = function (id) {
    processor.postMessage({
        token: jwt.token,
        type: 'workout',
        id: id
    });
};

(function(document) {
    'use strict';

    // Grab a reference to our auto-binding template
    // and give it some initial binding values
    // Learn more about auto-binding templates at http://goo.gl/Dx1u2g
    var app = document.querySelector('#app');

    app.displayInstalledToast = function() {
        document.querySelector('#caching-complete').show();
    };

    var mapSummary;
    var mapRunEle;
    var logBook;
    var workoutElement;
    var header;
    // Listen for template bound event to know when bindings
    // have resolved and content has been stamped to the page
    app.addEventListener('dom-change', function() {
        console.log('Our app is ready to rock!');
        mapSummary = document.querySelector('map-summary');
        mapRunEle = document.querySelector('map-run');
        logBook = document.querySelector('log-book');
        workoutElement = document.querySelector('workout-element');
        processor.onmessage = function (event) {
            if ('mapRunData' in event.data) {
                mapRunEle.setData(event.data.mapRunData);
            }
            if ('chartData' in event.data) {
                workoutElement.setChartData(event.data.chartData);
            }
            if ('logs' in event.data) {
                logBook.populateLogs(event.data.logs);
            }
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

        page('/', function () {
            logsFetching();
            header.toggleActive('home');
            app.route = 'home';
        });

        page('/users', function () {
            app.route = 'users';
        });

        page('/users/:name', function (data) {
            app.route = 'user-info';
            app.params = data.params;
        });

        page('/settings', function () {
            app.route = 'settings';
            header.toggleActive('settings');
        });

        page('/contact', function () {
            app.route = 'contact';
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
            maxFilesize: 60, // MB
            acceptedFiles: '.fit',
            uploadMultiple: false,
            addRemoveLinks: true,
            dictDefaultMessage: 'Drop your FIT file here to upload (Or click to select from computer)',
            dictInvalidFileType: 'File type is not supported. Please upload valid sports watch data file.',
            accept: function (file, done) {
                done();
            },
            success: function (file, message) {
                console.log(message);
                logsFetching();
            },
            error: function (file, message) {
                console.log(message);
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

    window.addEventListener('WebComponentsReady', function() {
    });

    // Close drawer after menu item is selected if drawerPanel is narrow
    app.onMenuSelect = function() {
        var drawerPanel = document.querySelector('#paperDrawerPanel');
        if (drawerPanel.narrow) {
            drawerPanel.closeDrawer();
        }
    };
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
})(document);

