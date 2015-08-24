/*jshint -W079 */
/*jshint unused:false*/

(function(document) {
    'use strict';

    // Grab a reference to our auto-binding template
    // and give it some initial binding values
    // Learn more about auto-binding templates at http://goo.gl/Dx1u2g
    var app = document.querySelector('#app');

    app.displayInstalledToast = function() {
    document.querySelector('#caching-complete').show();
    };

    // Listen for template bound event to know when bindings
    // have resolved and content has been stamped to the page
    app.addEventListener('dom-change', function() {
    console.log('Our app is ready to rock!');
    });

    app.logout = function() {
        jwt.logout();
    };

    // See https://github.com/Polymer/polymer/issues/1381
    window.addEventListener('WebComponentsReady', function() {
    // imports are loaded and elements have been registered
    });

    // Main area's paper-scroll-header-panel custom condensing transformation of
    // the appName in the middle-container and the bottom title in the bottom-container.
    // The appName is moved to top and shrunk on condensing. The bottom sub title
    // is shrunk to nothing on condensing.
    addEventListener('paper-header-transform', function(e) {
    var appName = document.querySelector('.app-name');
    var middleContainer = document.querySelector('.middle-container');
    var bottomContainer = document.querySelector('.bottom-container');
    var detail = e.detail;
    var heightDiff = detail.height - detail.condensedHeight;
    var yRatio = Math.min(1, detail.y / heightDiff);
    var maxMiddleScale = 0.50;  // appName max size when condensed. The smaller the number the smaller the condensed size.
    var scaleMiddle = Math.max(maxMiddleScale, (heightDiff - detail.y) / (heightDiff / (1-maxMiddleScale))  + maxMiddleScale);
    var scaleBottom = 1 - yRatio;

    // Move/translate middleContainer
    Polymer.Base.transform('translate3d(0,' + yRatio * 100 + '%,0)', middleContainer);

    // Scale bottomContainer and bottom sub title to nothing and back
    Polymer.Base.transform('scale(' + scaleBottom + ') translateZ(0)', bottomContainer);

    // Scale middleContainer appName
    Polymer.Base.transform('scale(' + scaleMiddle + ') translateZ(0)', appName);
    });

    // Close drawer after menu item is selected if drawerPanel is narrow
    app.onMenuSelect = function() {
    var drawerPanel = document.querySelector('#paperDrawerPanel');
    if (drawerPanel.narrow) {
        drawerPanel.closeDrawer();
    }
    };
})(document);

function Interpolate(start, end, steps, count) {
    var s = start,
        e = end,
        final = s + (((e - s) / steps) * count);
    return Math.floor(final);
}

function Color(_r, _g, _b) {
    var r, g, b;
    var setColors = function(_r, _g, _b) {
        r = _r;
        g = _g;
        b = _b;
    };

    setColors(_r, _g, _b);
    this.getColors = function() {
        var colors = {
            r: r,
            g: g,
            b: b
        };
        return colors;
    };
}

function componentToHex(c) {
    var hex = c.toString(16);
    return hex.length === 1 ? '0' + hex : hex;
}

function rgbToHex(r, g, b) {
    return '#' + componentToHex(r) + componentToHex(g) + componentToHex(b);
}

var mapSummary;
var mapRun;
var logBook;
var workoutElement;

window.addEventListener('WebComponentsReady', function() {
    mapSummary = document.querySelector('map-summary');
    mapRun = document.querySelector('map-run');
    logBook = document.querySelector('log-book');
    workoutElement = document.querySelector('workout-element');
});

var workoutProcessing = function (workout) {
    var avgs = {
        power: 0,
        powerCount: 0,
        pace: 0
    };

    var maxPower = workout.max_power;

    var steps = 1;
    if (workout.total_power_list.length > 200) {
        steps = parseInt(workout.total_power_list.length / 200);
    }
    var lowColorRGB = new Color(95, 180, 61), highColorRGB = new Color(243, 60, 52);
    var lowColors = lowColorRGB.getColors(), highColors = highColorRGB.getColors();
    var chartData = [], mapRunData = [];
    var hex, i;
    var graphSegment = {}, entry = {};
    for (i = 0; i < workout.total_power_list.length; i = i + steps) {
        graphSegment = {};
        entry = {};
        /* Assemble Chart Data */
        if ('timestamp_list' in workout) {
            entry.date = setDate(workout.timestamp_list[i]);
        }
        if ('heart_rate_list' in workout) {
            entry.heartRate = workout.heart_rate_list[i];
        }
        if ('speed_list' in workout) {
            entry.pace = workout.speed_list[i];
        }
        if ('total_power_list' in workout) {
            entry.power = workout.total_power_list[i];
            if (entry.power > 5) {
            avgs.powerCount += 1;
            avgs.power += entry.power;
            }
        }
        if ('cadence_list' in workout) {
            entry.cadence = workout.cadence_list[i];
        }
        if ('elevation_list' in workout) {
            entry.elevation = Math.round(workout.elevation_list[i]);
        }
        if ('distance_list' in workout) {
            entry.distance = workout.distance_list[i];
        }
        chartData.push(entry);
        /* Assemble Map Data */
        if (i > 0) {
            hex = rgbToHex(
                Interpolate(lowColors.r, highColors.r, maxPower, entry.power),
                Interpolate(lowColors.g, highColors.g, maxPower, entry.power),
                Interpolate(lowColors.b, highColors.b, maxPower, entry.power)
            );
            graphSegment = {
                hex: hex,
                location: [
                    {
                        lat: workout.loc_list[i-steps].Lat,
                        lng: workout.loc_list[i-steps].Lng,
                    },
                    {
                        lat: workout.loc_list[i].Lat,
                        lng: workout.loc_list[i].Lng,
                    }
                ]
            };
            mapRunData.push(graphSegment);
        }
    }
    avgs.power = avgs.power / avgs.powerCount;
    avgs.pace = (workout.distance / 1600) / (workout.moving_time / 60);

    workoutElement.setChartData(chartData);
    // mapSummary.setWorkout(workout);
    mapRun.setData(mapRunData);
};

var workoutFetching = function (workout) {
    superagent
    .get('/b/api/v1/activities/' + workout.id)
    .send()
    .set('Accept', 'application/json')
    .set('Authorization', 'Bearer: ' + jwt.token)
    .end(function(err, res) {
        if (res.ok) {
            workoutProcessing(res.body);
        } else {
            console.log('Error: Cannot fetch workout');
        }
    });
};

var logsProcessing = function (logs) {
    if (logs.length > 0) {
        workoutFetching(logs[0]);
    }
    logBook.populateLogs(logs);
};

var logsFetching = function () {
    superagent
        .get('/b/api/v1/activities/summary?limit=20')
        .send()
        .set('Accept', 'application/json')
        .set('Authorization', 'Bearer: ' + jwt.token)
        .end(function(err, res) {
            if (res.ok) {
                if (res.body !== null) {
                    logsProcessing(res.body);
                } else {
                    console.log('no workout received');
                }
            } else {
                console.log('failure on grabLogs', err, res);
            }
        }.bind(this));
};

var truncate = function (n) {
    var parts = String(n).split('.');
    var shortened = '';
    if (parts.length > 1) {
        shortened =  parts[0] + '.' + parts[1].substring(0, 2);
    } else {
        shortened =  parts[0];
    }

    return shortened;
};

Number.prototype.stat = function () {
    return this.toFixed(1);
};

String.prototype.stat = function () {
    var parts = String(this).split('.');
    var shortened = '';
    if (parts.length > 1) {
    // shortened =  parts[0] + '.' + parts[1].substring(0, 2);
    shortened =  parts[0];
    } else {
    shortened =  parts[0];
    }
    return shortened;
};

/* Helper functions */
var fillZero = function (n) {
    n = String(n);
    if (n.length === 1) {
        return '0' + n;
    } else {
        return n;
    }
};

// For pace
var minutesPerMile = function (mps) {
    if (mps === 0) {
        return 0;
    }
    return parseFloat((1/(mps * (60/1609.34))).toFixed(1));
};
function speedToPaceForBalloon(graphDataItem, graph) {
    var value = graphDataItem.values.value;
    return minutesPerMile(value) + ' Min/Mile';
}
function speedToPaceForValueAxis(value, formattedValue, valueAxis) {
    return minutesPerMile(value);
}

// For time
var setDate = function (ms) {
    return new Date(ms * 1000);
};
var hmsTime = function (s) {
    var time = new Date(s);
    return fillZero(time.getUTCHours()) + ':' + fillZero(time.getMinutes()) + '.' + fillZero(time.getSeconds());
};
var hrTime = function (s) {
    var time = new Date(s);
    var hrsRun = (time.getUTCHours() + time.getMinutes() / 60 + time.getSeconds() / 3600);
    return hrsRun.toFixed(1);
};

// For distance
var meterToKM = function (m) {
    return (m/1000).toFixed(1);
};
var meterToMile = function (m) {
    return (m/1600).toFixed(1);
};
