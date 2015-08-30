/*jshint -W079 */
/*jshint unused:false*/
/*jshint -W079 */
var processor = new Worker('/profile/scripts/processor.js');

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
    var mapRun;
    var logBook;
    var workoutElement;
    var header;
    // Listen for template bound event to know when bindings
    // have resolved and content has been stamped to the page
    app.addEventListener('dom-change', function() {
        console.log('Our app is ready to rock!');
        mapSummary = document.querySelector('map-summary');
        mapRun = document.querySelector('map-run');
        logBook = document.querySelector('log-book');
        workoutElement = document.querySelector('workout-element');
        processor.onmessage = function (event) {
            if ('mapRunData' in event.data) {
                mapRun.setData(event.data.mapRunData);
            }
            if ('chartData' in event.data) {
                workoutElement.setChartData(event.data.chartData);
            }
            if ('logs' in event.data) {
                logBook.populateLogs(event.data.logs);
            }
            if (event.data.type === 'sample') {
                mapRun.classList.add('sample');
                workoutElement.classList.add('sample');
                logBook.classList.add('sample');
                document.querySelector('#sample').show();
            } else {
                mapRun.classList.remove('sample');
                workoutElement.classList.remove('sample');
                logBook.classList.remove('sample');
                document.querySelector('#sample').hide();
            }
        };

        header = document.querySelector('header-element');
        // We use Page.js for routing. This is a Micro
        // client-side router inspired by the Express router
        // More info: https://visionmedia.github.io/page.js/
        page.base('/profile');

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

