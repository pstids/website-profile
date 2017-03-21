/*jshint -W079 */
/*jshint unused:false*/
/*global onmessage:true*/
/*global importScripts:true*/
/*global postMessage*/
/*global Dexie:true*/
/*global self*/

importScripts('/powercenter/scripts/processor.min.js');

var data = {};
var token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJlbWFpbCI6Imd1ZXN0QHN0cnlkLmNvbSIsImV4cCI6NDYwNDk2MjEwMTk1NiwiZmlyc3RuYW1lIjoiU3RyeWQiLCJpZCI6Ii0xIiwiaW1hZ2UiOiIiLCJsYXN0bmFtZSI6IlJ1bm5lciIsInVzZXJuYW1lIjoiZ3Vlc3QifQ.jlm3nYOYP_L9r8vpOB0SOGnj5t9i8FWwpn5UxOfar1M';

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
        return `#${this.componentToHex(r)}${this.componentToHex(g)}${this.componentToHex(b)}`;
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

class DB {
    constructor() {
        this.storage = new Dexie('Logs');
        this.storage.version(1).stores({
            log: '++id, data'
        });
        this.storage.open();
    }
}
var db = new DB();

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
        var sortedPower = powers.sort((a, b) => {
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

var getDateHash = function (timestamp) {
    return moment.unix(timestamp).format('YYYYMMDD');
};

var averageChartData = function (id, average_period) {
    console.log(id, average_period);
    console.log('average chart data');

    // var chartData = [];

    // var steps = 1;

    // var movingAverages = {
    //     heartRate: 0,
    //     speed: 0,
    //     power: ,
    //     formPower: 0,
    //     cadence: 0,
    //     vertOsc: 0,
    //     legSpring: 0,
    //     groundTime: 0
    // };
};

var createChartData = function (workout) {
    var chartData = [];
    var lastEntry = {}, entry = {};
    var suuntoDrop = true;

    for (var i = 0; i < workout.total_power_list.length; i += 1) {
        suuntoDrop = true;
        entry = {};

        if ('timestamp_list' in workout) {
            if (i < workout.timestamp_list.length) {
                entry.date = setDate(workout.timestamp_list[i]);
            } else {
                entry.date = 0;
            }
        }
        if ('heart_rate_list' in workout) {
            if (i < workout.heart_rate_list.length) {
                entry.heartRate = workout.heart_rate_list[i];
            } else {
                entry.heartRate = 0;
            }
            if (entry.heartRate !== 0) {
                suuntoDrop = false;
            }
        }
        if ('speed_list' in workout && workout.speed_list !== null) {
            if (i < workout.speed_list.length) {
                entry.pace = workout.speed_list[i];
            } else {
                entry.pace = 0;
            }
        }
        if ('speed_device_list' in workout && workout.speed_device_list !== null) {
            if (i < workout.speed_device_list.length) {
                entry.devicePace = workout.speed_device_list[i];
            } else {
                entry.devicePace = 0;
            }
        }
        if ('total_power_list' in workout) {
            if (i < workout.total_power_list.length) {
                entry.power = workout.total_power_list[i];
            } else {
                entry.power = 0;
            }
            if (entry.power !== 0) {
                suuntoDrop = false;
            }
        }
        if ('vertical_power_list' in workout && workout.vertical_power_list !== null) {
            if (i < workout.vertical_power_list.length) {
                entry.formPower = workout.vertical_power_list[i];
            } else {
                entry.formPower = 0;
            }
            if (entry.power !== 0) {
                suuntoDrop = false;
            }
        }
        if ('cadence_list' in workout) {
            if (i < workout.cadence_list.length) {
                entry.cadence = workout.cadence_list[i];
            } else {
                entry.cadence = 0;
            }
            if (entry.cadence !== 0) {
                suuntoDrop = false;
            }
        }
        if ('elevation_list' in workout && workout.elevation_list !== null) {
            if (i < workout.elevation_list.length) {
                entry.elevation = Math.round(workout.elevation_list[i] * 10) / 10;
            } else {
                entry.elevation = 0;
            }
            if (entry.elevation !== 0) {
                suuntoDrop = false;
            }
        }
        if ('oscillation_list' in workout && workout.oscillation_list !== null && i < workout.oscillation_list.length) {
            if (i < workout.oscillation_list.length) {
                entry.vertOsc = workout.oscillation_list[i];
            } else {
                entry.vertOsc = 0;
            }
        }
        if ('leg_spring_list' in workout && workout.leg_spring_list !== null && i < workout.leg_spring_list.length) {
            if (i < workout.leg_spring_list.length) {
                entry.legSpring = workout.leg_spring_list[i];
            } else {
                entry.legSpring = 0;
            }
        }
        if ('ground_time_list' in workout && workout.ground_time_list !== null && i < workout.ground_time_list.length) {
            if (i < workout.ground_time_list.length) {
                entry.groundTime = workout.ground_time_list[i];
            } else {
                entry.groundTime = 0;
            }
        }
        if ('elevation_device_list' in workout && workout.elevation_device_list !== null) {
            if (i < workout.elevation_device_list.length) {
                entry.deviceElevation = Math.round(workout.elevation_device_list[i] * 10) / 10;
            } else {
                entry.deviceElevation = 0;
            }
        }
        if ('stress_list' in workout && workout.stress_list !== null) {
            if (i >= workout.stress_list.length || workout.stress_list[i] === undefined) {
                entry.rss = 0;
            } else {
                entry.rss = +workout.stress_list[i].toFixed(1);
            }
        }
        if ('distance_list' in workout && workout.distance_list !== null) {
            //if (i < workout.distance_list.length) {
                entry.distance = workout.distance_list[i];
            // } else {
            //     if (lastEntry !== {}) {
            //         entry.distance = lastEntry.distance;
            //     } else {
            //         entry.distance = 0;
            //     }
            // }
        }

        if (suuntoDrop && i !== 0) {
            entry = lastEntry;
        } else {
            lastEntry = entry;
        }

        chartData.push(entry);
    }
    return chartData;
};

var workoutSave = function (workout, id) {
    id = +id;
    if (!(id in activeMemory)) {
        activeMemory[id] = workout;
    }
    if (!(id in seriesMemory)) {
        seriesMemory[id] = createChartData(workout);
    }
    db.storage.log.put({
        id: String(id),
        data: workout
    });
};

var workoutUpdate = function (workout, id) {
    id = +id;
    activeMemory[id] = workout;
    seriesMemory[id] = createChartData(workout);
    db.storage.log.put({
        id: String(id),
        data: workout
    });
};

var add = function (a, b) {
    return (+a) + (+b);
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

    var mapRunData = [];
    var availableMetrics = ['power'];
    var sum = 0;

    if ('heart_rate_list' in workout && workout.heart_rate_list !== null) {
        sum = workout.heart_rate_list.slice(0, 1000).reduce(add, 0);
        if (sum > 0) {
            availableMetrics.push('heartRate');
        }
    }
    if ('speed_list' in workout && workout.speed_list !== null) {
        // sum = workout.speed_list.slice(0, 10).reduce(add, 0);
        // if (sum > 0) {
        availableMetrics.push('pace');
        // }
    }
    if ('speed_device_list' in workout && workout.speed_device_list !== null) {
        // sum = workout.speed_device_list.slice(0, 10).reduce(add, 0);
        // if (sum > 0) {
        availableMetrics.push('devicePace');
        // }
    }
    if ('vertical_power_list' in workout && workout.vertical_power_list !== null) {
        // sum = workout.vertical_power_list.slice(0, 10).reduce(add, 0);
        // if (sum > 0) {
        availableMetrics.push('formPower');
        // }
    }
    if ('cadence_list' in workout && workout.cadence_list !== null) {
        // sum = workout.cadence_list.slice(0, 10).reduce(add, 0);
        // if (sum > 0) {
        availableMetrics.push('cadence');
        // }
    }
    if ('oscillation_list' in workout && workout.oscillation_list !== null) {
        // sum = workout.oscillation_list.slice(0, 10).reduce(add, 0);
        // if (sum > 0) {
        availableMetrics.push('vertOsc');
        // }
    }
    if ('leg_spring_list' in workout && workout.leg_spring_list !== null) {
        // sum = workout.leg_spring_list.slice(0, 10).reduce(add, 0);
        // if (sum > 0) {
        availableMetrics.push('legSpring');
        // }
    }
    if ('ground_time_list' in workout && workout.ground_time_list !== null) {
        // sum = workout.ground_time_list.slice(0, 10).reduce(add, 0);
        // if (sum > 0) {
        availableMetrics.push('groundTime');
        // }
    }
    if ('elevation_list' in workout && workout.elevation_list !== null) {
        // sum = workout.elevation_list.slice(0, 10).reduce(add, 0);
        // if (sum > 0) {
        availableMetrics.push('elevation');
        // }
    }
    if ('elevation_device_list' in workout && workout.elevation_device_list !== null) {
        // sum = workout.elevation_device_list.slice(0, 10).reduce(add, 0);
        // if (sum > 0) {
        availableMetrics.push('deviceElevation');
        // }  
    }
    if ('stress_list' in workout && workout.stress_list !== null) {
        // sum = workout.stress_list.slice(0, 10).reduce(add, 0);
        // if (sum > 0) {
        availableMetrics.push('rss'); 
        // }
    }

    // Limit displayed records to prevent browser slugginess
    var steps = 1;
    if (workout.total_power_list.length > 500) {
        steps = parseInt(workout.total_power_list.length / 500);
    }
    if (steps < 1) {
        steps = 1;
    }

    var hasLocList = ('loc_list' in workout && workout.loc_list !== null);
    var lastSegment = {
        lat: 0,
        lng: 0,
    };
    if (hasLocList) {
        lastSegment = {
            lat: workout.loc_list[0].Lat,
            lng: workout.loc_list[0].Lng,
        };
    }

    for (var i = 0; i < workout.total_power_list.length; i += steps) {
        /* Assemble chart data */
        var power = workout.total_power_list[i];
        if (power > 5) {
            avgs.powerCount += 1;
            avgs.power += power;
        }

        /* Assemble map data */
        if (i > 0 && hasLocList) {
            var relativePower;
            if (threshold.range === 0) {
                threshold.range = 1;
                relativePower = 1;
            } else if (power > threshold.high) {
                relativePower = threshold.range;
            } else if (power < threshold.low) {
                relativePower = 0;
            } else {
                relativePower = power - threshold.low;
            }
            var hex = colorInterpolate.HEX(relativePower, threshold.range);
            var newSegment = {
                lat: workout.loc_list[i].Lat,
                lng: workout.loc_list[i].Lng,
            };
            var graphSegment = {
                hex: hex,
                location: [lastSegment, newSegment]
            };
            mapRunData.push(graphSegment);
            lastSegment = JSON.parse(JSON.stringify(newSegment));
        }
    }
    avgs.power = avgs.power / avgs.powerCount;
    avgs.pace = (workout.distance / 1600) / (workout.moving_time / 60);

    data.mapRunData = mapRunData;

    var chartData = [];
    if (id in seriesMemory) {
        chartData = seriesMemory[id];
    } else {
        chartData = createChartData(workout);
        seriesMemory[id] = chartData;
    }
    data.chartData = chartData;

    data.chartDescription = {
        description: workout.description,
        id: workout.id,
        user_id: workout.user_id,
        start_time: workout.start_time,
        stress: workout.stress
    };
    data.workout = {
        stress: workout.stress,
        average_power: workout.average_power,
        average_speed: workout.average_speed,
        elapsed_time: workout.elapsed_time,
        seconds_in_zones: workout.seconds_in_zones,
        start_time: workout.start_time,
        id: workout.id,
        distance: workout.distance,
    };
    if ('rpe' in workout) {
        data.workout.rpe = workout.rpe;
    } else {
        data.workout.rpe = 0;
    }
    if ('type' in workout) {
        data.workout.type = workout.type;
    } else {
        data.workout.type = '';
    }
    data.steps = steps;
    if (id === 'sample') {
        data.logs = [workout];
        data.type = 'sample';
    } else {
        data.type = 'data';
    }
    data.workoutShared = workout;
    data.availableMetrics = availableMetrics;

    if (!(id in activeMemory)) {
        activeMemory[id] = workout;
    }

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
    workoutID = +workoutID;
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
        db.storage.log.get(String(workoutID), (log) => {
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

var workoutFetchingComparisonAJAX = function (workoutID, resolve) {
    superagent
        .get(`/b/api/v1/activities/${workoutID}`)
        .send()
        .set('Accept', 'application/json')
        .set('Authorization', `Bearer: ${token}`)
        .end((err, res) => {
            if (res.ok) {
                workoutSave(res.body, workoutID);
                resolve(workoutID);
            } else {
                console.log('Error: cannot fetch workout');
                resolve(workoutID);
            }
        });
};

var workoutFetchingComparison = function (workoutID, workoutUpdated, resolve) {
    workoutID = +workoutID;
    var getExternal, workoutUpdatedTS, logUpdatedTS;
    var checkIndexedDB = self.indexedDB || self.mozIndexedDB || self.webkitIndexedDB || self.msIndexedDB;
    if (workoutID in activeMemory) {
        workoutUpdatedTS = new Date(workoutUpdated);
        logUpdatedTS = new Date(activeMemory[workoutID].updated_time);
        getExternal = (workoutUpdatedTS !== undefined && isNaN(logUpdatedTS) === true) ||
            (workoutUpdatedTS !== undefined && isNaN(logUpdatedTS) === false && workoutUpdatedTS.getTime() > logUpdatedTS.getTime());
        if (getExternal) {
            workoutFetchingComparisonAJAX(workoutID, resolve);
        } else {
            resolve(workoutID);
        }
    } else if (!checkIndexedDB) {
        workoutFetchingComparisonAJAX(workoutID, resolve);
    } else {
        db.storage.log.get(String(workoutID), (log) => {
            if (log === undefined) {
                workoutFetchingComparisonAJAX(workoutID, resolve);
            } else {
                workoutUpdatedTS = new Date(workoutUpdated);
                logUpdatedTS = new Date(log.data.updated_time);
                getExternal = (workoutUpdatedTS !== undefined && isNaN(logUpdatedTS) === true) ||
                    (workoutUpdatedTS !== undefined && isNaN(logUpdatedTS) === false && workoutUpdatedTS.getTime() > logUpdatedTS.getTime());
                if (getExternal) {
                    workoutFetchingComparisonAJAX(workoutID, resolve);
                } else {
                    activeMemory[workoutID] = log.data;
                    resolve(workoutID);
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

var updateLog = function (id) {
    superagent
        .get(`/b/api/v1/activities/${id}`)
        .send({})
        .set('Accept', 'application/json')
        .set('Authorization', `Bearer: ${token}`)
        .end((err, res) => {
            if (res.ok) {
                workoutUpdate(res.body, id);
                data.updateLog = res.body;
                postMessage(data);
                console.log('Success: Updated workout');
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
        workoutFetchingComparison(idPrimary, updatedTime, resolve);
    });
    var activitySecondary = new Promise(resolve => {
        if (+idSecondary === 0) {
            resolve(0);
        } else {
            workoutFetchingComparison(idSecondary, updatedTime, resolve);
        }
    });
    Promise.all([activityPrimary, activitySecondary])
        .then(values => {
            data.comparison = true;
            data.activityPrimary = activeMemory[values[0]];
            data.activityIDPrimary = idPrimary;
            data.dataPrimary = workoutProcessingComparison(data.activityPrimary);
            if (values[1] === 0) {
                data.activitySecondary = 0;
                data.activityIDSecondary = 0;
                data.dataSecondary = 0;
            } else {
                data.activitySecondary = activeMemory[values[1]];
                data.activityIDSecondary = idSecondary;
                data.dataSecondary = workoutProcessingComparison(data.activitySecondary);
            }
            data.maxRSS = Math.max(
                data.activityPrimary.stress,
                data.activitySecondary.stress
            );
            data.maxPower = Math.max(
                data.activityPrimary.max_power,
                data.activitySecondary.max_power
            );
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

var calcMetrics = function (startTime, endTime, activityID, userUnit) {
    resetMetrics();
    var activity = seriesMemory[activityID];

    var start = 0;
    var end = activity.length-1;

    var hasStartIdx = false;
    var hasEndIdx = false;
    for (var i = 0; i < activity.length; i++) {
        if (!hasStartIdx && activity[i].date >= startTime) {
            hasStartIdx = true;
            start = i;
        }
        if (!hasEndIdx && activity[i].date >= endTime) {
            hasEndIdx = true;
            end = i;
        }
    }
    if (!hasStartIdx) {
        start = 0;
    }
    if (!hasEndIdx) {
        end = activity.length-1;
    }

    for (i = start; i < end; i++) {
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

    var total = end - start;

    var distance = 0;
    if ('distance' in activity[start]) {
        distance = activity[end].distance - activity[start].distance;
    }
    var milliseconds = activity[end].date - activity[start].date;
    var seconds = milliseconds / 1000;

    var paceUnit = unit.speedUnit(userUnit);
    var distanceUnit = unit.distanceUnit(userUnit);
    var distanceDisplay = unit.distanceValue(distance, userUnit);
    var distanceValue = unit.distanceValueRaw(distance, userUnit);

    metrics.time.totalTime.value = hmsTime(milliseconds);
    metrics.pace.pace.unit = paceUnit;
    metrics.pace.maxPace.unit = paceUnit;
    metrics.power.rss.unit = activity.stress;
    metrics.misc.distance.unit = distanceUnit;

    var elapsedMinutes = seconds / 60;
    var movingMinutes = metrics.time.time.moving / 1000 / 60;

    var elapsedDec = elapsedMinutes / distanceValue;
    var movingDec = movingMinutes / distanceValue;

    metrics.pace.pace.elapsed = unit.paceFormat(elapsedDec);
    metrics.pace.pace.moving = unit.paceFormat(movingDec);
    metrics.pace.maxPace.value = unit.speedValue(metrics.pace.maxPace.value, userUnit) + unit.speedUnit(userUnit);

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
        tiz: [0, 0, 0, 0, 0],
        rss: 0,
        startTimestamp: 0,
        endTimestamp: 0
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
        tiz: [0, 0, 0, 0, 0],
        rss: 0
    };
};

var calcAverage = function (key, value) {
    lap[key] = lap[key] + ((value - lap[key]) / ++lapCount[key]);
};

var calcLaps = function (type, activityID, zones, userUnit) {
    var laps = [];
    var lapCount = 0;
    resetLap();
    activityID = +activityID;

    var activity = seriesMemory[activityID];
    var oActivity = activeMemory[activityID];

    var lapTimestamps = [];
    var lastLapTimestamp = null;
    var lastLapTimestampIter = 0;

    if (oActivity.lap_timestamp_list === null || oActivity.lap_timestamp_list.length === 0) {
        lapTimestamps = [];
        lastLapTimestamp = null;
    } else {
        lapTimestamps = oActivity.lap_timestamp_list;
        for (var g = 0; g < oActivity.lap_timestamp_list.length; g++) {
            // Set base date to 1970 if the base level is 1990
            if (oActivity.lap_timestamp_list[g] < 999999999) {
                oActivity.lap_timestamp_list[g] += 631065600;
            }
        }
        lastLapTimestamp = lapTimestamps[lastLapTimestampIter];
    }
    var keepLapSearching = true;

    var samples = 0;
    var lastDistance = 0;
    var lastTimestamp = activity[0].date;
    var lastRSS = 0;

    var lapSwitch = false;

    for (var i = 0; i < activity.length; i++) {
        var entry = activity[i];

        var power = entry.power;

        // calculate moving average for code simplicity
        calcAverage('power', power);
        calcAverage('formPower', entry.formPower);
        calcAverage('legSpring', entry.legSpring);

        // add to time in zones
        if (zones !== null) {
            for (var o = 0; o < 5; o++) {
                if (power > zones[o].power_low && power < zones[o].power_high) {
                    lap.tiz[o] += 1;
                }
            }
        }

        // check if distance passes mile marker
        if (type === 'mi') {
            if (entry.distance - lastDistance > unit.metersPerMile) {
                lapSwitch = true;
            }
        // check if distance passes km marker
        } else if (type === 'km') {
            if (entry.distance - lastDistance > unit.metersPerKM) {
                lapSwitch = true;
            }
        // check if timestamp passes lap timestamp marker
        } else if (type === 'split' && keepLapSearching) {
            if (lastLapTimestamp !== null && entry.date > setDate(lastLapTimestamp)) {
                lastLapTimestampIter++;
                if (lastLapTimestampIter < lapTimestamps.length) {
                    lastLapTimestamp = lapTimestamps[lastLapTimestampIter];
                } else {
                    keepLapSearching = false;
                }
                lapSwitch = true;
            }
        }
        // if we are at the end, create a lap
        if (i === activity.length-1) {
            lapSwitch = true;
        }
        if (lapSwitch) {
            var meters = entry.distance - lastDistance;
            lap.distance = meters;
            // sets distance to marker distance to prevent customer confusion
            if (type === 'mi' && lap.distance > 1609.34) {
                lap.distance = unit.metersPerMile;
            } else if (type === 'km' && lap.distance > 1000) {
                lap.distance = unit.metersPerKM;
            }
            lap.lap = ++lapCount;
            var seconds = (entry.date - lastTimestamp)/1000;
            lap.time = secToDuration(seconds);
            lap.pace = unit.speedValue(meters/seconds, userUnit) + unit.speedUnit(userUnit);
            lap.ratio = (lap.power/lap.formPower).toFixed(1);
            lap.rss = entry.rss - lastRSS;
            lap.startTimestamp = lastTimestamp;
            lap.endTimestamp = entry.date;

            lastDistance = entry.distance;
            lastTimestamp = entry.date;
            lastRSS = entry.rss;

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
                event.data.zones,
                event.data.unit
            );
            break;
        case 'updateLog':
            updateLog(event.data.id);
            break;
        default:
            console.log('Error in onmessage/processor: unknown action');
    }
};