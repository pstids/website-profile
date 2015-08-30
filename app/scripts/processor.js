/*jshint -W079 */
/*jshint unused:false*/
/*global onmessage:true*/
/*global importScripts:true*/
/*global postMessage*/

importScripts('/profile/scripts/superagent.js');
importScripts('/profile/scripts/toolbox.js');

var data = {}, token;

onmessage = function (event) {
    data = {};
    token = event.data.token;
    if (event.data.type === 'all') {
        logsFetching();
    } else if (event.data.type === 'workout') {
        workoutFetching(event.data.id);
    } else if (event.data.type === 'sample') {
        workoutFetching('sample');
    }
};

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

var calcThreshold = function (powers) {
    powers = JSON.parse(JSON.stringify(powers));
    var sortedPower = powers.sort(function (a, b) {
        return a - b;
    });

    var count = sortedPower.length;
    var segment = parseInt(count / 4, 10);
    var lowIQR = sortedPower[segment],
        median = sortedPower[segment * 2],
        highIQR = sortedPower[segment * 3];
    var IQR = parseInt((highIQR - lowIQR) * 1.5, 10);
    var thresholdHigh = median + IQR,
        thresholdLow = median - IQR;
    var threshold = {
        range: thresholdHigh - thresholdLow,
        high: thresholdHigh,
        low: thresholdLow
    };
    return threshold;
};

var workoutProcessing = function (workout, id) {
    var threshold = calcThreshold(workout.total_power_list);

    var avgs = {
        power: 0,
        powerCount: 0,
        pace: 0
    };

    var maxPower = workout.max_power;

    var steps = 1;
    if (workout.total_power_list.length > 800) {
        steps = parseInt(workout.total_power_list.length / 800);
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
            var relativePower;
            if (threshold.range === 0) {
                threshold.range = 1;
                relativePower = 1;
            } else if (entry.power > threshold.high) {
                relativePower = threshold.range;
            } else if (entry.power < threshold.low) {
                relativePower = 0;
            } else {
                relativePower = entry.power - threshold.low;
            }
            hex = rgbToHex(
                Interpolate(lowColors.r, highColors.r, threshold.range, relativePower),
                Interpolate(lowColors.g, highColors.g, threshold.range, relativePower),
                Interpolate(lowColors.b, highColors.b, threshold.range, relativePower)
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

    data.mapRunData = mapRunData;
    data.chartData = chartData;
    if (id === 'sample') {
        data.logs = [workout];
        data.type = 'sample';
    } else {
        data.type = 'data';
    }
    postMessage(data);
};

var workoutFetching = function (workout) {
    superagent
    .get('/b/api/v1/activities/' + workout)
    .send()
    .set('Accept', 'application/json')
    .set('Authorization', 'Bearer: ' + token)
    .end(function(err, res) {
        if (res.ok) {
            workoutProcessing(res.body, workout);
        } else {
            console.log('Error: Cannot fetch workout');
        }
    });
};

var logsProcessing = function (logs) {
    data.logs = logs;
    if (logs.length > 0) {
        workoutFetching(logs[0].id);
    } else {
        postMessage();
    }
    // logBook.populateLogs(logs);
};

var logsFetching = function () {
    superagent
        .get('/b/api/v1/activities/summary?limit=20&sortby=Timestamp&order=desc')
        .send()
        .set('Accept', 'application/json')
        .set('Authorization', 'Bearer: ' + token)
        .end(function(err, res) {
            if (res.ok) {
                if (res.body !== null) {
                    logsProcessing(res.body);
                } else {
                    workoutFetching('sample');
                }
            } else {
                console.log('Error: failure on grabLogs', err, res);
            }
        }.bind(this));
};