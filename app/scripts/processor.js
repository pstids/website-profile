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

var data = {};
var token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJlbWFpbCI6Imd1ZXN0QHN0cnlkLmNvbSIsImV4cCI6NDYwNDk2MjEwMTk1NiwiZmlyc3RuYW1lIjoiU3RyeWQiLCJpZCI6Ii0xIiwiaW1hZ2UiOiIiLCJsYXN0bmFtZSI6IlJ1bm5lciIsInVzZXJuYW1lIjoiZ3Vlc3QifQ.jlm3nYOYP_L9r8vpOB0SOGnj5t9i8FWwpn5UxOfar1M';
var db;

var activeMemory = {};
var seriesMemory = {};

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
    if (db === null) {
        db = new Dexie('Logs');
        db.version(1).stores({
            log: '++id, data'
        });
        db.open();
    }
};
initDB();

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

var workoutProcessing = function (workout, id) {
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
    if (workout.total_power_list.length > 1000) {
        steps = parseInt(workout.total_power_list.length / 1000);
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
        start_time: workout.start_time,
        stress: workout.stress
    };
    data.steps = steps;
    if (id === 'sample') {
        data.logs = [workout];
        data.type = 'sample';
    } else {
        data.type = 'data';
    }
    data.workoutShared = workout;
    data.availableMetrics = availableMetrics;

    activeMemory[id] = workout;
    seriesMemory[id] = chartData;
    postMessage(data);
};

var workoutFetchingAJAX = function (workoutID) {
    if (token === undefined) {
        token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJlbWFpbCI6Imd1ZXN0QHN0cnlkLmNvbSIsImV4cCI6NDYwNDk2MjEwMTk1NiwiZmlyc3RuYW1lIjoiU3RyeWQiLCJpZCI6Ii0xIiwiaW1hZ2UiOiIiLCJsYXN0bmFtZSI6IlJ1bm5lciIsInVzZXJuYW1lIjoiZ3Vlc3QifQ.jlm3nYOYP_L9r8vpOB0SOGnj5t9i8FWwpn5UxOfar1M';
    }

    superagent
        .get(`/b/api/v1/activities/${workoutID}`)
        .send()
        .set('Accept', 'application/json')
        .set('Authorization', `Bearer: ${token}`)
        .end((err, res) => {
            if (res.ok) {
                workoutSave(res.body, workoutID);
                workoutProcessing(res.body, workoutID);
            } else {
                console.log('Error: cannot fetch workout');
            }
        });
};

var workoutFetching = function (workoutID, workoutUpdated) {
    var getExternal, workoutUpdatedTS, logUpdatedTS;
    var checkIndexedDB = self.indexedDB || self.mozIndexedDB || self.webkitIndexedDB || self.msIndexedDB;
    if (workoutID in activeMemory) {
        workoutUpdatedTS = new Date(workoutUpdated);
        logUpdatedTS = new Date(activeMemory[workoutID].updated_time);
        getExternal = (workoutUpdatedTS !== undefined && isNaN(logUpdatedTS) === true) ||
            (workoutUpdatedTS !== undefined && isNaN(logUpdatedTS) === false && workoutUpdatedTS.getTime() > logUpdatedTS.getTime());
        if (getExternal) {
            workoutFetchingAJAX(workoutID);
        } else {
            workoutProcessing(activeMemory[workoutID], workoutID);
        }
    } else if (!checkIndexedDB) {
        workoutFetchingAJAX(workoutID);
    } else {
        db.log.get(String(workoutID), (log) => {
            if (log === undefined) {
                workoutFetchingAJAX(workoutID);
            } else {
                workoutUpdatedTS = new Date(workoutUpdated);
                logUpdatedTS = new Date(log.data.updated_time);
                getExternal = (workoutUpdatedTS !== undefined && isNaN(logUpdatedTS) === true) ||
                    (workoutUpdatedTS !== undefined && isNaN(logUpdatedTS) === false && workoutUpdatedTS.getTime() > logUpdatedTS.getTime());
                if (getExternal) {
                    workoutFetchingAJAX(workoutID);
                } else {
                    workoutProcessing(log.data, log.id);
                }
            }
        });
    }
};

var workoutProcessingComparison = function (workout) {
    if (workout.total_power_list === null) {
        return [];
    }
    var data = [];
    for (var i = 0; i < workout.total_power_list.length; i += 1) {
        var entry = {};
        if ('timestamp_list' in workout) {
            entry.date = setDate(workout.timestamp_list[i]);
        }
        if ('total_power_list' in workout) {
            entry.power = workout.total_power_list[i];
        }
        if ('stress_list' in workout && workout.stress_list !== null) {
            entry.rss = workout.stress_list[i].toFixed(1);
        }
        data.push(entry);
    }
    return data;
};

var workoutFetchingComparisonAJAX = function (workoutID) {
    superagent
        .get(`/b/api/v1/activities/${workoutID}`)
        .send()
        .set('Accept', 'application/json')
        .set('Authorization', `Bearer: ${token}`)
        .end((err, res) => {
            if (res.ok) {
                return res.body;
            } else {
                console.log('Error: cannot fetch workout');
                return null;
            }
        });
};

var workoutFetchingComparison = function (workoutID, workoutUpdated) {
    var checkIndexedDB = self.indexedDB || self.mozIndexedDB || self.webkitIndexedDB || self.msIndexedDB;
    if (!checkIndexedDB) {
        return workoutFetchingComparisonAJAX(workoutID);
    } else {
        return db.log.get(String(workoutID), (log) => {
            if (log === undefined) {
                return workoutFetchingComparisonAJAX(workoutID);
            } else {
                var workoutUpdatedTS = new Date(workoutUpdated);
                var logUpdatedTS = new Date(log.data.updated_time);
                var getExternal = (workoutUpdatedTS !== undefined && isNaN(logUpdatedTS) === true) ||
                    (workoutUpdatedTS !== undefined && isNaN(logUpdatedTS) === false && workoutUpdatedTS.getTime() > logUpdatedTS.getTime());
                if (getExternal) {
                    return workoutFetchingComparisonAJAX(workoutID);
                } else {
                    if (typeof log.data === 'undefined') {
                        return workoutFetchingComparisonAJAX(workoutID);
                    }
                    return log.data;
                }
            }
        });
    }
};

var addLog = function (workoutID) {
    superagent
        .get(`/b/api/v1/activities/${workoutID}`)
        .send({})
        .set('Accept', 'application/json')
        .set('Authorization', `Bearer: ${token}`)
        .end((err, res) => {
            if (res.ok) {
                workoutSave(res.body, workoutID);
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
                for (var workoutID of res.body.workouts) {
                    addLog(workoutID);
                }
            }
        });
};

var workoutComparison = function (idPrimary, idSecondary, updatedTime) {
    var activityPrimary = new Promise(resolve => {
        resolve(workoutFetchingComparison(idPrimary, updatedTime));
    });
    var activitySecondary = new Promise(resolve => {
        if (+idSecondary === 0) {
            resolve(0);
        } else {
            resolve(workoutFetchingComparison(idSecondary, updatedTime));
        }
    });
    Promise.all([activityPrimary, activitySecondary])
        .then(values => {
            data.comparison = true;
            data.activityPrimary = values[0];
            data.activityIDPrimary = idPrimary;
            data.dataPrimary = workoutProcessingComparison(values[0]);
            if (values[1] === 0) {
                data.activitySecondary = 0;
                data.activityIDSecondary = 0;
                data.dataSecondary = 0;
            } else {
                data.activitySecondary = values[1];
                data.activityIDSecondary = idSecondary;
                data.dataSecondary = workoutProcessingComparison(values[1]);
            }
            postMessage(data);
        });
};

var metrics = {};
var resetMetrics = function () {
    metrics = {
        pace: {
            active: ['pace'],
            pace: {
                icon: 'maps:directions-run',
                title: 'Pace',
                moving: 0,
                elapsed: 0,
                unit: 0
            },
            maxPace: {
                icon: 'maps:directions-run',
                title: 'Max Pace',
                value: 0,
                unit: 0
            }
        },
        time: {
            active: ['time'],
            time: {
                icon: 'image:timer',
                title: 'Time',
                value: 0,
                moving: 0,
                elapsed: 0,
                mseconds: 0,
                unit: 'HH:MM:SS'
            },
            totalTime: {
                icon: 'image:timer',
                title: 'Total Time',
                value: 0,
                unit: 'HH:MM:SS'
            }
        },
        power: {
            active: ['power'],
            power: {
                icon: 'image:flash-on',
                title: 'Power',
                moving: 0,
                elapsed: 0,
                mTotal: 0,
                unit: 'Watts'
            },
            maxPower: {
                icon: 'image:flash-on',
                title: 'Max Power',
                value: 0,
                unit: 'Watts'
            },
            rss: {
                icon: 'image:flash-on',
                title: 'RSS',
                value: 0,
                unit: ''
            }
        },
        heartRate: {
            active: ['formPower', 'legSpring', 'heartRate'],
                formPower: {
                icon: 'places:hot-tub',
                title: 'Form Power',
                elapsed: 0,
                moving: 0,
                mTotal: 0,
                unit: 'Watts'
            },
            legSpring: {
                icon: 'image:leak-add',
                title: 'Leg Spring',
                elapsed: 0,
                moving: 0,
                mTotal: 0,
                unit: 'kN/M'
            },
            heartRate: {
                icon: 'favorite',
                title: 'HR',
                moving: 0,
                elapsed: 0,
                mTotal: 0,
                value: 0,
                sum: 0,
                total: 0,
                unit: 'BPM'
            }
        },
        dynamics: {
            active: ['cadence', 'groundTime', 'vertOsc'],
            cadence: {
                icon: 'maps:directions-walk',
                title: 'Cadence',
                elapsed: 0,
                moving: 0,
                mTotal: 0,
                unit: 'SPM'
            },
            groundTime: {
                icon: 'av:av-timer',
                title: 'Ground Time',
                elapsed: 0,
                moving: 0,
                mTotal: 0,
                unit: 'MS'
            },
            vertOsc: {
                icon: 'communication:call-missed',
                title: 'Vert. Osc.',
                elapsed: 0,
                moving: 0,
                mTotal: 0,
                unit: 'CM'
            }
        },
        misc: {
            active: [],
            distance: {
                icon: 'communication:swap-calls',
                title: 'Distance',
                value: 0,
                unit: ''
            }
        }
    };
};

var calcMetrics = function (start, end, activityID, unit) {
    let lmetric = new Metric('my_event');
    lmetric.start();
    resetMetrics();
    var activity = seriesMemory[activityID];

    if (end === 0) {
        end = activity.length-1;
    }

    var total = end - start;

    var distance = activity[end-1].distance - activity[start].distance;
    var milliseconds = activity[end-1].date - activity[start].date;
    var seconds = milliseconds / 1000;

    var paceUnit = 'Min/Mi';
    var distanceUnit = 'Mi';
    var distanceDisplay = meterToMile(distance, 1);
    var distanceValue = distance/metersPerMile;
    if (unit === 'meters') {
        paceUnit = 'Min/KM';
        distanceUnit = 'KM';
        distanceDisplay = meterToKM(distance);
        distanceValue = distance/metersPerKM;
    }

    metrics.time.totalTime.value = hmsTime(milliseconds);
    metrics.pace.pace.unit = paceUnit;
    metrics.pace.maxPace.unit = paceUnit;
    metrics.power.rss.unit = activity.stress;
    metrics.misc.distance.unit = distanceUnit;

    for (var i = start; i < end; i++) {
        var entry = activity[i];

        var timeSectionMSeconds = 1000;
        if (i !== end - 1) {
            timeSectionMSeconds = activity[i+1].date - activity[i].date;
        }
        metrics.time.time.elapsed += timeSectionMSeconds;

        if ('pace' in entry) {
            if (
                entry.pace > metrics.pace.maxPace.value
            ) {
                metrics.pace.maxPace.value = entry.pace;
            }
        }

        if ('power' in entry) {
            if (
                entry.power > metrics.power.maxPower.value
            ) {
                metrics.power.maxPower.value = entry.power.toFixed(0);
            }
            if (entry.power > 0) {
                metrics.time.time.moving += timeSectionMSeconds;
            }
            metrics.power.power.elapsed += entry.power;
            if (entry.power > 10) {
                metrics.power.power.moving += entry.power;
                metrics.power.power.mTotal += 1;
            }
        }

        if ('heartRate' in entry && 'power' in entry) {
            metrics.heartRate.heartRate.elapsed += entry.heartRate;

            if (entry.power > 10) {
                metrics.heartRate.heartRate.moving += entry.heartRate;
                metrics.heartRate.heartRate.mTotal += 1;
            }
        }

        if ('cadence' in entry) {
            metrics.dynamics.cadence.elapsed += entry.cadence;
            if (entry.power > 10) {
                metrics.dynamics.cadence.moving += entry.cadence;
                metrics.dynamics.cadence.mTotal += 1;
            }
        }

        if ('groundTime' in entry && 'power' in entry) {
            metrics.dynamics.groundTime.elapsed += entry.groundTime;
            if (entry.power > 10) {
                metrics.dynamics.groundTime.moving += entry.groundTime;
                metrics.dynamics.groundTime.mTotal += 1;
            }
        }

        if ('vertOsc' in entry && 'power' in entry) {
            metrics.dynamics.vertOsc.elapsed += entry.vertOsc;
            if (entry.power > 10) {
                metrics.dynamics.vertOsc.moving += entry.vertOsc;
                metrics.dynamics.vertOsc.mTotal += 1;
            }
        }

        if ('formPower' in entry && 'power' in entry) {
            metrics.heartRate.formPower.elapsed += entry.formPower;
            if (entry.power > 10) {
                metrics.heartRate.formPower.moving += entry.formPower;
                metrics.heartRate.formPower.mTotal += 1;
            }
        }

        if ('legSpring' in entry && 'power' in entry) {
            metrics.heartRate.legSpring.elapsed += entry.legSpring;
            if (entry.power > 10) {
                metrics.heartRate.legSpring.moving += entry.legSpring;
                metrics.heartRate.legSpring.mTotal += 1;
            }
        }
    }

    var elapsedMinutes = seconds / 60;
    var movingMinutes = metrics.time.time.moving / 1000 / 60;

    var elapsedDec = elapsedMinutes / distanceValue;
    var movingDec = movingMinutes / distanceValue;

    metrics.pace.pace.elapsed = formatPace(elapsedDec);
    metrics.pace.pace.moving = formatPace(movingDec);
    metrics.pace.maxPace.value = speedToPace(metrics.pace.maxPace.value, unit);

    metrics.power.power.moving = (metrics.power.power.moving / metrics.power.power.mTotal).stat();
    metrics.power.power.elapsed = (metrics.power.power.elapsed / total).stat();

    metrics.heartRate.heartRate.moving = (metrics.heartRate.heartRate.moving / metrics.heartRate.heartRate.mTotal).stat();
    metrics.heartRate.heartRate.elapsed = (metrics.heartRate.heartRate.elapsed / total).stat();

    metrics.time.time.elapsed = hmsTime(metrics.time.time.elapsed);
    metrics.time.time.moving = hmsTime(metrics.time.time.moving);

    if (isNaN(distance)) {
        metrics.misc.distance.value = 'Not';
        metrics.misc.distance.unit = 'Available';
    } else {
        metrics.misc.distance.value = distanceDisplay;
        metrics.misc.distance.unit = distanceUnit;
    }

    metrics.dynamics.cadence.moving = (metrics.dynamics.cadence.moving / metrics.dynamics.cadence.mTotal).stat();
    metrics.dynamics.cadence.elapsed = (metrics.dynamics.cadence.elapsed / total).stat();

    if (metrics.dynamics.groundTime.elapsed !== 0) {
        metrics.dynamics.groundTime.moving = (metrics.dynamics.groundTime.moving / metrics.dynamics.groundTime.mTotal).stat();
        metrics.dynamics.groundTime.elapsed = (metrics.dynamics.groundTime.elapsed / total).stat();
    } else {
        delete metrics.dynamics.groundTime;
    }

    if (metrics.dynamics.vertOsc.elapsed !== 0) {
        metrics.dynamics.vertOsc.moving = (metrics.dynamics.vertOsc.moving / metrics.dynamics.vertOsc.mTotal).stat();
        metrics.dynamics.vertOsc.elapsed = (metrics.dynamics.vertOsc.elapsed / total).stat();
    } else {
        delete metrics.dynamics.vertOsc;
    }

    if (metrics.heartRate.formPower.elapsed !== 0) {
        metrics.heartRate.formPower.moving = (metrics.heartRate.formPower.moving / metrics.heartRate.formPower.mTotal).stat();
        metrics.heartRate.formPower.elapsed = (metrics.heartRate.formPower.elapsed / total).stat();
    } else {
        delete metrics.heartRate.formPower;
    }

    if (metrics.heartRate.legSpring.elapsed !== 0) {
        metrics.heartRate.legSpring.moving = (metrics.heartRate.legSpring.moving / metrics.heartRate.legSpring.mTotal).stat();
        metrics.heartRate.legSpring.elapsed = (metrics.heartRate.legSpring.elapsed / total).stat();
    } else {
        delete metrics.heartRate.legSpring;
    }

    delete metrics.heartRate.movingHR;

    data.metrics = metrics;
    lmetric.end();
    lmetric.log();
    postMessage(data);
};

var lap = {};
var lapCount = {};
var resetLap = function () {
    lap = {
        lap: 0,
        power: 0,
        time: 0,
        distance: 0,
        formPower: 0,
        legSpring: 0,
        pace: 0,
        ratio: 0,
        tiz: [0, 0, 0, 0, 0]
    };
    lapCount = {
        lap: 0,
        power: 0,
        time: 0,
        distance: 0,
        formPower: 0,
        legSpring: 0,
        pace: 0,
        ratio: 0,
        tiz: [0, 0, 0, 0, 0]
    };
};

var calcAverage = function (key, value) {
    lap[key] = lap[key] + ((value - lap[key]) / ++lapCount[key]);
};

var calcLaps = function (type, activityID, zones) {
    var laps = [];
    var lapCount = 0;
    resetLap();

    var activity = seriesMemory[activityID];
    var oActivity = activeMemory[activityID];
    console.log(oActivity);

    //var timestamps = oActivity.lap_timestamp_list;
    var lapTimestamps = [1485288924, 1485289491, 1485290240, 1485290737, 1485291048];
    var lastLapTimestampIter = 0;
    var lastLapTimestamp = lapTimestamps[lastLapTimestampIter];
    var keepLapSearching = true;

    var samples = 0;
    var lastDistance = 0;
    var lastTimestamp = activity[0].date;

    var lapSwitch = false;

    for (var i = 0; i < activity.length; i++) {
        var entry = activity[i];

        var power = entry.power;

        calcAverage('power', power);
        calcAverage('formPower', entry.formPower);
        calcAverage('legSpring', entry.legSpring);

        for (var o = 0; o < 5; o++) {
            if (power > zones[o].power_low && power < zones[o].power_high) {
                lap.tiz[o] += 1;
            }
        }

        if (type === 'mi') {
            if (entry.distance - lastDistance > metersPerMile) {
                lapSwitch = true;
            }
        } else if (type === 'km') {
            if (entry.distance - lastDistance > metersPerKM) {
                lapSwitch = true;
            }
        } else if (type === 'split' && keepLapSearching) {
            if (entry.date > setDate(lastLapTimestamp)) {
                lastLapTimestampIter++;
                if (lastLapTimestampIter < lapTimestamps.length) {
                    lastLapTimestamp = lapTimestamps[lastLapTimestampIter];
                } else {
                    keepLapSearching = false;
                }
                lapSwitch = true;
            }
        }
        if (!lapSwitch && i === activity.length-1) {
            lapSwitch = true;
        }
        if (lapSwitch) {
            var meters = entry.distance - lastDistance;
            lap.distance = meters;
            lap.lap = ++lapCount;
            var seconds = (entry.date - lastTimestamp)/1000;
            lap.time = secToDuration(seconds);
            lap.pace = speedToPace(meters/seconds, 'feet');
            lap.ratio = (lap.power/lap.formPower).toFixed(1);

            lastDistance = entry.distance;
            lastTimestamp = entry.date;

            laps.push(lap);
            resetLap();
            lapSwitch = false;
        }
    }
    data.laps = laps;
    postMessage(data);
};

/* Public method */
onmessage = function (event) {
    data = {};
    token = event.data.token;

    switch(event.data.type) {
        case 'workout':
            workoutFetching(
                event.data.id,
                event.data.updated_time
            );
            break;
        case 'workoutComparison':
            workoutComparison(
                event.data.params.idPrimary,
                event.data.params.idSecondary,
                event.data.updated_time
            );
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
        case 'metrics':
            calcMetrics(
                event.data.start,
                event.data.end,
                event.data.activityID,
                event.data.unit
            );
            break;
        case 'laps':
            calcLaps(
                event.data.lapMarker,
                event.data.activityID,
                event.data.zones
            );
            break;
        default:
            console.log('Error in onmessage/processor: unknown action');
    }
};