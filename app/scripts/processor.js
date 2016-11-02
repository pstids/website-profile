/*jshint -W079 */
/*jshint unused:false*/
/*global onmessage:true*/
/*global importScripts:true*/
/*global postMessage*/
/*global Dexie:true*/
/*global self*/
/*global trainingPlan:true */
/*global trainingDays:true */

importScripts('/powercenter/scripts/processor.min.js');

var data = {}, token, db;

class ColorInterpolate {
    constructor() {
        this.lowColorRGB = {
            r: 95,
            g: 180,
            b: 61
        };
        this.highColorRGB = {
            r: 243,
            g: 60,
            b: 52
        };
    }
    interpolate(start, end, steps, count) {
        var final = start + (((end - start) / steps) * count);
        return Math.floor(final);
    }
    componentToHex(c) {
        var hex = c.toString(16);
        return hex.length === 1 ? '0' + hex : hex;
    }
    rgbToHex(r, g, b) {
        return '#' + this.componentToHex(r) + this.componentToHex(g) + this.componentToHex(b);
    }
    getRGB(relativePower, thresholdRange) {
        var r = this.interpolate(
            this.lowColorRGB.r,
            this.highColorRGB.r,
            thresholdRange,
            relativePower
        );
        var g = this.interpolate(
            this.lowColorRGB.g,
            this.highColorRGB.g,
            thresholdRange,
            relativePower
        );
        var b = this.interpolate(
            this.lowColorRGB.b,
            this.highColorRGB.b,
            thresholdRange,
            relativePower
        );
        return [r, g, b];
    }
    HEX(relativePower, thresholdRange) {
        var rgb = this.getRGB(relativePower, thresholdRange);
        return this.rgbToHex(rgb[0], rgb[1], rgb[2]);
    }
    RGB(relativePower, thresholdRange) {
        var rgb = this.getRGB(relativePower, thresholdRange);
        return `rgb(${rgb[0]}, ${rgb[1]}, ${rgb[2]})`;
    }
}

var colorInterpolate = new ColorInterpolate();

/* Private methods */
var initDB = function () {
    db = new Dexie('Logs');
    db.version(1).stores({
        log: '++id, data'
    });
    db.open();
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

var trainingPlan = {};
var trainingDays = {};
var trainingGraphDays = {};

var getDateHash = function (timestamp) {
    return moment.unix(timestamp).format('YYYYMMDD');
};

var processTrainingDay = function (day) {
    //day as parameter
    var trainingArray = [];
    for (var i = 0; i < day.blocks.length; i++) {
        var block = day.blocks[i];
        for (var o = 0; o < block.segments.length; o++) {
            var segment = block.segments[o];
            if (segment.duration_type === 'minutes') {
                var seconds = segment.duration_length * 60;
                for (var p = 0; p < seconds; p++) {
                    trainingArray.push(segment.low_range);
                }
            }
        }
    }
    return trainingArray;
};


var populateTrainingDays = function () {
    for (var key in trainingDays) {
        trainingGraphDays[key] = processTrainingDay(trainingDays[key]);
    }
};

var checkTrainingDay = function (timestamp) {
    var dateHash = getDateHash(timestamp);
    if (dateHash in trainingDays) {
        return true;
    } else {
        return false;
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
    if (steps < 1) {
        steps = 1;
    }

    var chartData = [], mapRunData = [];
    var hex, i;
    var graphSegment = {};

    var lastEntry = {};
    var suuntoDrop = true;

    var availableMetrics = [];

    for (i = 0; i < workout.total_power_list.length; i += steps) {
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
            if (entry.heartRate !== 0 && availableMetrics.indexOf('heartRate') === -1) {
                availableMetrics.push('heartRate');
            }
        }
        if ('speed_list' in workout && workout.speed_list !== null) {
            entry.pace = workout.speed_list[i];
            if (entry.pace !== 0 && availableMetrics.indexOf('pace') === -1) {
                availableMetrics.push('pace');
            }
        }
        if ('speed_device_list' in workout && workout.speed_device_list !== null) {
            entry.devicePace = workout.speed_device_list[i];
            if (entry.devicePace !== 0 && availableMetrics.indexOf('devicePace') === -1) {
                availableMetrics.push('devicePace');
            }
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
            if (entry.power !== 0 && availableMetrics.indexOf('power') === -1) {
                availableMetrics.push('power');
            }
        }
        if ('vertical_power_list' in workout && workout.vertical_power_list !== null) {
            entry.formPower = workout.vertical_power_list[i];
            if (entry.power !== 0) {
                suuntoDrop = false;
            }
            if (entry.formPower !== 0 && availableMetrics.indexOf('formPower') === -1) {
                availableMetrics.push('formPower');
            }
        }
        if ('cadence_list' in workout) {
            entry.cadence = workout.cadence_list[i];
            if (entry.cadence !== 0) {
                suuntoDrop = false;
            }
            if (entry.cadence !== 0 && availableMetrics.indexOf('cadence') === -1) {
                availableMetrics.push('cadence');
            }
        }
        if ('oscillation_list' in workout && workout.oscillation_list !== null && i < workout.oscillation_list.length) {
            entry.vertOsc = workout.oscillation_list[i];
            if (entry.vertOsc !== 0 && availableMetrics.indexOf('vertOsc') === -1) {
                availableMetrics.push('vertOsc');
            }
        }
        if ('leg_spring_list' in workout && workout.leg_spring_list !== null && i < workout.leg_spring_list.length) {
            entry.legSpring = workout.leg_spring_list[i];
            if (entry.legSpring !== 0 && availableMetrics.indexOf('legSpring') === -1) {
                availableMetrics.push('legSpring');
            }
        }
        if ('ground_time_list' in workout && workout.ground_time_list !== null && i < workout.ground_time_list.length) {
            entry.groundTime = workout.ground_time_list[i];
            if (entry.groundTime !== 0 && availableMetrics.indexOf('groundTime') === -1) {
                availableMetrics.push('groundTime');
            }
        }
        if ('elevation_list' in workout && workout.elevation_list !== null) {
            entry.elevation = Math.round(workout.elevation_list[i] * 10) / 10;
            if (entry.elevation !== 0) {
                suuntoDrop = false;
            }
            if (entry.elevation !== 0 && availableMetrics.indexOf('elevation') === -1) {
                availableMetrics.push('elevation');
            }
        }
        if ('elevation_device_list' in workout && workout.elevation_device_list !== null) {
            entry.deviceElevation = Math.round(workout.elevation_device_list[i] * 10) / 10;
            if (entry.deviceElevation !== 0 && availableMetrics.indexOf('deviceElevation') === -1) {
                availableMetrics.push('deviceElevation');
            }       
        }
        if ('distance_list' in workout && workout.distance_list !== null) {
            entry.distance = workout.distance_list[i];
        }
        // if (checkTrainingDay(workout.timestamp)) {
        //     var graphTraining = trainingGraphDays[getDateHash(workout.timestamp)];
        //     if (i < graphTraining.length) {
        //         entry.training = graphTraining[i];
        //     } else {
        //         entry.training = 0;
        //     }
        // }

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
            hex = colorInterpolate.HEX(relativePower, threshold.range);
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

    data.chartDescription = {
        description: workout.description,
        id: workout.id,
        user_id: workout.user_id,
        start_time: workout.start_time
    };
    data.steps = steps;
    if (id === 'sample') {
        data.logs = [workout];
        data.type = 'sample';
    } else {
        data.type = 'data';
    }
    data.workoutShared = workout;
    data.scope = scope;
    data.availableMetrics = availableMetrics;
    postMessage(data);
};

var workoutFetchingAJAX = function (workout, scope) {
    superagent
        .get(`/b/api/v1/activities/${workout}`)
        .send()
        .set('Accept', 'application/json')
        .set('Authorization', `Bearer: ${token}`)
        .end((err, res) => {
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
        db.log.get(String(workoutID), (log) => {
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

var logsProcessing = function (logs) {
    data.logs = logs;
    postMessage(data);
};

var addLog = function (id) {
    superagent
        .get(`/b/api/v1/activities/${id}`)
        .send({})
        .set('Accept', 'application/json')
        .set('Authorization', `Bearer: ${token}`)
        .end((err, res) => {
            if (res.ok) {
                workoutSave(res.body, id);
                data.addLog = res.body;
                postMessage(data);
                console.log('Success: Added workout');
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
        .end((err, res) => {
            if (res.ok && res.body.workouts !== null) {
                for (var i = 0; i < res.body.workouts.length; i++) {
                    var workoutID = res.body.workouts[i];
                    addLog(workoutID);
                }
            }
        });
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
        case 'suuntoProcessing':
            suuntoProcessing();
            break;
        case 'setPlan':
            trainingPlan = event.data.trainingPlan;
            trainingDays = event.data.trainingDays;
            populateTrainingDays();
            break;
        default:
            console.log('Error in onmessage/processor: unknown action');
    }
};
