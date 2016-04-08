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

var interpolate = function (start, end, steps, count) {
    var s = start,
        e = end,
        final = s + (((e - s) / steps) * count);
    return Math.floor(final);
};

var componentToHex = function (c) {
    var hex = c.toString(16);
    return hex.length === 1 ? '0' + hex : hex;
};

var rgbToHex = function (r, g, b) {
    return '#' + componentToHex(r) + componentToHex(g) + componentToHex(b);
};

var calcThreshold = function (nPowers) {
    var threshold = {
        range: 1,
        high: 1,
        low: 0
    };
    if (nPowers !== null) {
        // We need to create a duplicate list, so the original list is not sorted
        var powers = [];
        for (var i = 0; i < nPowers.length; i++) {
            powers.push(nPowers[i]);
        }
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
        threshold = {
            range: thresholdHigh - thresholdLow,
            high: thresholdHigh,
            low: thresholdLow
        };
    }
    return threshold;
};

var workoutSave = function (workout, id) {
    db.log.put({
        id: String(id),
        data: workout
    });
};

var workoutFetchingAJAX = function (workout, scope) {
    superagent
        .get(`/b/api/v1/activities/${workout}`)
        .send()
        .set('Accept', 'application/json')
        .set('Authorization', `Bearer: ${token}`)
        .end(function(err, res) {
            if (res.ok) {
                workoutProcessing(res.body, workout, scope);
            } else {
                console.log('Error: cannot fetch workout');
            }
        });
};

var workoutFetching = function (workoutID, workoutUpdated, scope) {
    var checkIndexedDB = self.indexedDB || self.mozIndexedDB || self.webkitIndexedDB || self.msIndexedDB;
    if (!checkIndexedDB) {
        workoutFetchingAJAX(workoutID);
    } else {
        db.log.get(String(workoutID), function (log) {
            if (log === undefined) {
                workoutFetchingAJAX(workoutID, scope);
            } else {
                var workoutUpdatedTS = new Date(workoutUpdated);
                var logUpdatedTS = new Date(log.data.updated_time);
                var getExternal = (workoutUpdatedTS !== undefined && isNaN(logUpdatedTS) === true) ||
                    (workoutUpdatedTS !== undefined && isNaN(logUpdatedTS) === false && workoutUpdatedTS.getTime() > logUpdatedTS.getTime());
                if (getExternal) {
                    workoutFetchingAJAX(workoutID, scope);
                } else {
                    workoutProcessing(log.data, log.id, scope);
                }
            }
        });
    }
};

var workoutProcessing = function (workout, id, scope) {
    workoutSave(workout, id);
    if (workout.total_power_list === null) {
        data.error = true;
        postMessage(data);
        return;
    }
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

    var lastEntry = {};
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
        if ('oscillation_list' in workout && workout.oscillation_list !== null) {
            entry.vertOsc = workout.oscillation_list[i];
        }
        if ('ground_time_list' in workout && workout.ground_time_list !== null) {
            entry.groundTime = workout.ground_time_list[i];
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

        if (suuntoDrop && i !== 0) {
            entry = lastEntry;
        } else {
            lastEntry = entry;
        }
        suuntoDrop = true;
        
        chartData.push(entry);
        /* Assemble map data */
        if (
            i > 0 &&
            'loc_list' in workout &&
            workout.loc_list !== null &&
            'power' in entry
        ) {
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
    data.workoutShared = workout;
    data.scope = scope;
    postMessage(data);
};

var logsProcessing = function (logs) {
    data.logs = logs;
    postMessage(data);
};

var addLog = function (id) {
    superagent
        .get(`/b/api/v1/activities/${id}`)
        .send()
        .set('Accept', 'application/json')
        .set('Authorization', `Bearer: ${token}`)
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

var suuntoProcessing = function () {
    superagent
        .post('/b/internal/fetch/suunto')
        .send({})
        .set('Accept', 'application/json')
        .set('Authorization', `Bearer: ${token}`)
        .end(function (err, res) {
            if (res.ok && res.body.workouts !== null) {
                for (var i = 0; i < res.body.workouts.length; i++) {
                    var workoutID = res.body.workouts[i];
                    addLog(workoutID);
                }
            }
        }.bind(this));
};

/* Public method */
onmessage = function (event) {
    initDB();

    data = {};
    token = event.data.token;

    switch(event.data.type) {
        case 'workout':
            workoutFetching(event.data.id, event.data.updated_time, 'owned');
            break;
        case 'workout-view':
            workoutFetching(event.data.id, event.data.updated_time, 'owned');
            break;
        case 'addLog':
            addLog(event.data.id);
            break;
        default:
            console.log('Error in onmessage/processor: unknown action');
    }
};
