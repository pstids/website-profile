/*jshint -W079 */
/*jshint unused:false*/
/*global onmessage:true*/
/*global importScripts:true*/
/*global postMessage*/
/*global Dexie:true*/
/*global self*/

importScripts('/powercenter/scripts/superagent.js');
importScripts('/powercenter/scripts/toolbox.js');
importScripts('/powercenter/scripts/dexie.js');

var data = {}, token, db;

class Color {
    constructor(r, g, b) {
        this.r = r;
        this.g = g;
        this.b = b;
    }
    getColors() {
        return {
            r: this.r,
            g: this.g,
            b: this.b
        };
    }

}

/* Private methods */
var initDB = function () {
    db = new Dexie('Logs');
    db.version(1).stores({
        log: '++id, data'
    });
    db.open();
};

onmessage = function (event) {
    initDB();

    data = {};
    token = event.data.token;

    switch(event.data.type) {
        case 'all':
            logsFetching();
            break;
        case 'workout':
            workoutFetching(event.data.id);
            break;
        case 'sample':
            workoutFetching('sample');
            break;
        case 'addLog':
            addLog(event.data.id);
            break;
        default:
            console.log('Error in onmessage/processor: unknown action');
    }
};

function interpolate(start, end, steps, count) {
    var s = start,
        e = end,
        final = s + (((e - s) / steps) * count);
    return Math.floor(final);
}

var componentToHex = function (c) {
    var hex = c.toString(16);
    return hex.length === 1 ? '0' + hex : hex;
}

var rgbToHex = function (r, g, b) {
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

var workoutSave = function (workout, id) {
    db.log.put({
        id: id,
        data: workout
    });
};

var workoutFetchingAJAX = function (workout) {
    superagent
        .get('/b/api/v1/activities/' + workout)
        .send()
        .set('Accept', 'application/json')
        .set('Authorization', 'Bearer: ' + token)
        .end(function(err, res) {
            if (res.ok) {
                workoutProcessing(res.body, workout);
                workoutSave(res.body, workout);
            } else {
                console.log('Error: cannot fetch workout');
            }
        });
};

var workoutFetching = function (workout) {
    var checkIndexedDB = self.indexedDB || self.mozIndexedDB || self.webkitIndexedDB || self.msIndexedDB;
    if (!checkIndexedDB) {
        workoutFetchingAJAX(workout);
    } else {
        db.log.get(workout, function (log) {
            if (log === undefined) {
                workoutFetchingAJAX(workout);
            } else {
                workoutProcessing(log.data, log.id);
            }
        });
    }
};

var workoutProcessing = function (workout, id) {
    var threshold = calcThreshold(workout.total_power_list);

    var avgs = {
        power: 0,
        powerCount: 0,
        pace: 0
    };

    var maxPower = workout.max_power;

    // Limit displayed records to prevent browser slugginess
    var steps = 1;
    if (workout.total_power_list.length > 800) {
        steps = parseInt(workout.total_power_list.length / 800);
    }

    var lowColorRGB = new Color(95, 180, 61), highColorRGB = new Color(243, 60, 52);
    var lowColors = lowColorRGB.getColors(), highColors = highColorRGB.getColors();

    var chartData = [], mapRunData = [];
    var hex, i;
    var graphSegment = {};

    var lastEntry;
    var suuntoDrop = true;
    for (i = 0; i < workout.total_power_list.length; i = i + steps) {
        graphSegment = {};
        var entry = {};
        /* Assemble chart data */
        if ('timestamp_list' in workout) {
            entry.date = setDate(workout.timestamp_list[i]);
        }
        if ('heart_rate_list' in workout) {
            entry.heartRate = workout.heart_rate_list[i];
            if (entry.heartRate !== 0) {
                suuntoDrop = false;
            }
        }
        if ('speed_list' in workout && workout.speed_list !== null) {
            entry.pace = workout.speed_list[i];
        }
        if ('total_power_list' in workout) {
            entry.power = workout.total_power_list[i];
            if (entry.power > 5) {
                avgs.powerCount += 1;
                avgs.power += entry.power;
            }
            if (entry.power !== 0) {
                suuntoDrop = false;
            }
        }
        if ('cadence_list' in workout) {
            entry.cadence = workout.cadence_list[i];
            if (entry.cadence !== 0) {
                suuntoDrop = false;
            }
        }
        if ('elevation_list' in workout && workout.elevation_list !== null) {
            entry.elevation = Math.round(workout.elevation_list[i]);
            if (entry.elevation !== 0) {
                suuntoDrop = false;
            }
        }
        if ('distance_list' in workout && workout.distance_list !== null) {
            entry.distance = workout.distance_list[i];
        }

        if (suuntoDrop) {
            entry = lastEntry;
        } else {
            lastEntry = entry;
        }
        suuntoDrop = true;
        
        chartData.push(entry);
        /* Assemble map data */
        if (i > 0 && 'loc_list' in workout && workout.loc_list !== null) {
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
                interpolate(lowColors.r, highColors.r, threshold.range, relativePower),
                interpolate(lowColors.g, highColors.g, threshold.range, relativePower),
                interpolate(lowColors.b, highColors.b, threshold.range, relativePower)
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
    data.steps = steps;
    if (id === 'sample') {
        data.logs = [workout];
        data.type = 'sample';
    } else {
        data.type = 'data';
    }
    postMessage(data);
};

var logsProcessing = function (logs) {
    data.logs = logs;
    postMessage(data);
};

/* Public method */
onmessage = function (event) {
    initDB();

    data = {};
    token = event.data.token;
    if (event.data.type === 'all') {
        logsFetching();
    } else if (event.data.type === 'admin') {
        logsFetching(event.data.user);
    } else if (event.data.type === 'workout') {
        workoutFetching(event.data.id);
    } else if (event.data.type === 'sample') {
        workoutFetching('sample');
    } else if (event.data.type === 'addLog') {
        addLog(event.data.id);
    }
};

var addLog = function (id) {
    superagent
        .get('/b/api/v1/activities/' + id)
        .send()
        .set('Accept', 'application/json')
        .set('Authorization', 'Bearer: ' + token)
        .end(function(err, res) {
            if (res.ok) {
                workoutSave(res.body, id);
                data.addLog = res.body;
                postMessage(data);
            } else {
                console.log('Error: Cannot fetch workout');
            }
        });
};

var logsFetching = function (user='') {
    var link = '/b/api/v1/activities/summary?limit=20&sortby=Timestamp&order=desc';
    if (user.length > 0) {
        link = '/b/admin/users/' + user + '/activities/summary?limit=20&sortby=Timestamp&order=desc';
    }
    superagent
        .get(link)
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
