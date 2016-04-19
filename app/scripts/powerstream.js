/*jshint -W079 */
/*jshint -W083 */
/*jshint unused:false*/

'use strict';

var getCoor = function (data) {
    if (typeof data ==='object' && 'lat' in data && 'lng' in data) {
        return {
            lat: data.lat,
            lng: data.lng
        };
    } else {
        return {};
    }
};

var calcHaversine = function (start, now) {
    if (('lat' in start) && ('lat' in now) && start.lat !== undefined && now.lat !== undefined) {
        var r = 6371;
        var lat1 = start.lat.toRadians();
        var lat2 = now.lat.toRadians();
        var deltaLat = (now.lat - start.lat).toRadians();
        var deltaLng = (now.lng - start.lng).toRadians();

        var a = Math.sin(deltaLat/2) * Math.sin(deltaLat/2) +
                Math.cos(lat1) * Math.cos(lat2) * 
                Math.sin(deltaLng/2) * Math.sin(deltaLng/2);
        var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
        return r * c;
    } else {
        return 0;
    }
};

var users = {
    sarah: {
        img: 'https://storage.googleapis.com/stryd_static_assets/rmr-1.png',
        data: [],
        name: 'sarah',
        id: 'c59c6e91-8314-5e0f-470d-4f803baf8e64',
        pts: [],
        active: true,
        avgs: {
            heart_rate: 0,
            power: 0,
            cadence: 0,
            pts: 0
        },
        distance: 0,
        lineColor: '#683a78'
    },
    steven: {
        img: 'https://storage.googleapis.com/stryd_static_assets/rmr-2.png',
        data: [],
        name: 'steven',
        id: 'a4b09bb5-5b0a-506c-5a34-0d7aa975f29b',  
        pts: [],
        active: true,
        avgs: {
            heart_rate: 0,
            power: 0,
            cadence: 0,
            pts: 0
        },
        distance: 0,
        lineColor: '#074a8c'
    },
    brent: {
        img: 'https://storage.googleapis.com/stryd_static_assets/rmr-3.png',
        data: [],
        name: 'brent',
        id: '197a1a1e-1910-5bfa-4716-b64d789b3016',
        pts: [],
        active: true,
        avgs: {
            heart_rate: 0,
            power: 0,
            cadence: 0,
            pts: 0
        },
        distance: 0,
        lineColor: '#5ea7a1'
    },
    jon: {
        img: 'https://storage.googleapis.com/stryd_static_assets/phinney-circle.png',
        data: [],
        name: 'jon',
        id: '263d8deb-e68b-5781-432a-cebc5648db64',
        pts: [],
        active: true,
        avgs: {
            heart_rate: 0,
            power: 0,
            cadence: 0,
            pts: 0
        },
        distance: 0,
        lineColor: '#5ea7a2'
    }
};

window.addEventListener('WebComponentsReady', function() {
    var chart = document.querySelector('#chart2');

    var current = users.sarah;
    window.triggerAth = function (event) {
        var target = event.target;
        console.log(target.value);
        current = target.value;
        var currentU = users[current];
        chart.setChartData(currentU.data);
    };

    var app = document.querySelector('#app');
    var mapStream = document.querySelector('map-stream');
    // var mapSummary = document.querySelector('map-summary');
    var weight = 0;
    var addPoint = function (data) {
        if (!('lat' in data) || !('total_p' in data)) {
            return false;
        }

        var user = users.sarah;
        if ('id' in data) {
            for (var key in this.users) {
                if (this.users[key].id === data.id) {
                    user = this.users[key];
                }
            }
        }
        var d = data;
        d.heartRate = d.heartrate;

        d.total_p = parseInt(d.total_p);
        d.power = d.total_p;

        var lastGPS = this.getCoor(user.data[user.data.length-1]);
        if (lastGPS !== {}) {
            var dist = this.calcHaversine(lastGPS, getCoor(data));
            user.distance += dist;
        }

        d.distance = user.distance;

        d.elevation = 0;
        if (!('cadence' in d)) {
            d.cadence = 0;
        }
        d.pace = 0;
        if ('timestamp_p'  in d) {
            d.date = new Date(d.timestamp_p);
        } else if ('timestamp_l' in d) {
            d.date = new Date(d.timestamp_l);
        } else {
            d.date = Date.now();
        }

        /* Prevent vertical oscillation jumps */
        if (d.vertical_osc > 0.1) {
            weight = 0.92 * weight + 0.08 * d.vertical_osc;
            d.vertical_osc = weight.toFixed(2);
        }

        mapStream.addPoint(d);
        if (current.name === user.name) {
            chart.addPoint(d);
        }
    };

    setTimeout(function() { 
        setInterval(function() {
            console.log('Trigged Sarah\'s chartData');
            chart.refreshData();
        }, 60000);
    }, 10000);

    var getNewData = function () {
        var streamSocket = new WebSocket('ws://104.197.114.91:8080/ws?t=receiver');
        streamSocket.onopen = function () {
            console.log('Connected to WebSocket');
        };
        streamSocket.onmessage = function (event) {
            var point = JSON.parse(event.data);
            addPoint(point);
        };
        streamSocket.onclose = function (event) {
            console.log('WebSocket closed. Atempting to reconnect.');
            setTimeout(function() {
                getNewData();
            }, 5000);
        };
    };

    var processOld = function (data, id) {
        var user = users.sarah;
        for (var key in users) {
            if (users[key].id === id) {
                user = users[key];
            }
        }

        var oscWeight = 0;
        for (var i = data.length - 1; i >= 0; i--) {
            var d = data[i];

            if (('lat' in d)) {
                user.pts.push(getCoor(d));
            }

            if (i !== 0) {
                var lastGPS = data[i-1];
                if ('lat' in lastGPS) {
                    user.distance += calcHaversine(getCoor(lastGPS), getCoor(d));
                }
            }

            // Set properties for workoutEle
            d.heartRate = d.heartrate;

            d.total_p = parseInt(d.total_p);
            if ('total_p' in d) {
                d.power = d.total_p;
            } else {
                d.power = 0;
            }
            d.distance = user.distance;
            d.elevation = 0;
            if (('cadence' in d) && d.cadence !== undefined) {

            } else {
                d.cadence = 0;
            }
            d.pace = 8;
            if ('timestamp_p'  in d) {
                d.date = new Date(d.timestamp_p);
            } else if ('timestamp_l' in d) {
                d.date = new Date(d.timestamp_l);
            } else {
                d.date = Date.now();
            }

            /* Prevent vertical oscillation jumps */
            if (d.vertical_osc > 0.1) {
                weight = 0.92 * weight + 0.08 * d.vertical_osc;
                d.vertical_osc = weight.toFixed(2);
            }

            user.data.unshift(d);
        }

        mapStream.setOld(id);
        if (current.name === user.name) {
            chart.setChartData(user.data);
        }
    };

    var processForWorkout = function (data) {
        var workoutEle = document.querySelector('workout-element');
        for (var i = 0; i < data.length; i++) {
            var d = data[i];

            d.heartRate = d.heartrate;
            d.power = d.total_p;
            d.distance = 0;
            d.elevation = 0;
            d.cadence = 0;
            d.pace = 0;
            d.date = setDate(data.timestamp_p);
        }
        workoutEle.setChartData(data);
    };

    var getOldData = function () {
        var ids = ['c59c6e91-8314-5e0f-470d-4f803baf8e64', 'a4b09bb5-5b0a-506c-5a34-0d7aa975f29b', '197a1a1e-1910-5bfa-4716-b64d789b3016', '263d8deb-e68b-5781-432a-cebc5648db64'];
        superagent
            .get('http://104.197.114.91:8080/fetch?id=' + ids[0])
            .end(function(err, res) {
                if (res.ok) {
                    if (res.text !== 'none') {
                        console.log('Received data for', ids[0]);
                        var text = res.text.slice(0, - 1);
                        var oldData = JSON.parse('[' + text + ']');

                        processOld(oldData, ids[0]);
                    } else {
                        console.log('Error: No data for', ids[0]);
                        processOld([], ids[0]);
                    }
                } else {
                    console.log('Error: Cannot fetch old data', ids[0]);
                    processOld([], ids[0]);
                }
            });
        superagent
            .get('http://104.197.114.91:8080/fetch?id=' + ids[1])
            .end(function(err, res) {
                if (res.ok) {
                    if (res.text !== 'none') {
                        console.log('Received data for', ids[1]);
                        var text = res.text.slice(0, - 1);
                        var oldData = JSON.parse('[' + text + ']');

                        processOld(oldData, ids[1]);
                    } else {
                        console.log('Error: No data for', ids[1]);
                        processOld([], ids[1]);
                    }
                } else {
                    console.log('Error: Cannot fetch old data', ids[1]);
                    processOld([], ids[1]);
                }
            });
        superagent
            .get('http://104.197.114.91:8080/fetch?id=' + ids[2])
            .end(function(err, res) {
                if (res.ok) {
                    if (res.text !== 'none') {
                        console.log('Received data for', ids[2]);
                        var text = res.text.slice(0, - 1);
                        var oldData = JSON.parse('[' + text + ']');

                        processOld(oldData, ids[2]);
                    } else {
                        console.log('Error: No data for', ids[2]);
                        processOld([], ids[2]);
                    }
                } else {
                    console.log('Error: Cannot fetch old data', ids[2]);
                    processOld([], ids[2]);
                }
            });
        superagent
            .get('http://104.197.114.91:8080/fetch?id=' + ids[3])
            .end(function(err, res) {
                if (res.ok) {
                    if (res.text !== 'none') {
                        console.log('Received data for', ids[3]);
                        var text = res.text.slice(0, - 1);
                        var oldData = JSON.parse('[' + text + ']');

                        processOld(oldData, ids[3]);
                    } else {
                        console.log('Error: No data for', ids[3]);
                        processOld([], ids[3]);
                    }
                } else {
                    console.log('Error: Cannot fetch old data', ids[3]);
                    processOld([], ids[3]);
                }
            });
        getNewData();
    };

    getOldData();
});