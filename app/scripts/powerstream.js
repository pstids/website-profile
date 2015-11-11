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
    users.sarah.chart = document.querySelector('#sarah-chart');
    users.steven.chart = document.querySelector('#steven-chart');
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
        user.chart.addPoint(d);
    };

    setTimeout(function() { 
        setInterval(function() {
            console.log('Trigged Sarah\'s chartData');
            if (users.sarah.data.length > 0) {
                users.sarah.chart.refreshData();
            }
        }, 60000);
    }, 10000);

    setTimeout(function() { 
        setInterval(function() {
            console.log('Trigged Steven\'s chartData');
            if (users.steven.data.length > 0) {
                users.steven.chart.refreshData();
            }
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
            // mapSummary.addPoint(JSON.parse(event.data));
        };
        streamSocket.onclose = function (event) {
            console.log('WebSocket closed. Atempting to reconnect.');
            setTimeout(function() {
                getNewData();
            }, 5000);
            // intervalID = window.setInterval(getNewData, 5000);
        };
        // window.addEventListener('keydown', function (event) {
        //     switch (event.key) {
        //         case 'ArrowDown':
        //             streamSocket.send('hello return');
        //             break;
        //         default:
        //             return;
        //     }
        //     event.preventDefault();
        // }, true);
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
        user.chart.setChartData(user.data);
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

    // var fakeData = function () {
    //     var data = [
    //       {'lat':40.01786422729492,'lng':-105.2853393554688},{'lat':40.0178337097168,'lng':-105.2853393554688},{'lat':40.01779937744141,'lng':-105.2853317260742},{'lat':40.01776504516602,'lng':-105.2853164672852},{'lat':40.01773452758789,'lng':-105.2853164672852},{'lat':40.0177001953125,'lng':-105.2853088378906},{'lat':40.01766967773438,'lng':-105.285285949707},{'lat':40.01763916015625,'lng':-105.2852783203125},{'lat':40.01760482788086,'lng':-105.2852783203125},{'lat':40.01757049560547,'lng':-105.2852630615234},{'lat':40.01753616333008,'lng':-105.2852554321289},{'lat':40.01750183105469,'lng':-105.2852554321289},{'lat':40.01747131347656,'lng':-105.2852478027344},{'lat':40.01744079589844,'lng':-105.2852325439453},{'lat':40.01741409301758,'lng':-105.2852249145508},{'lat':40.01737976074219,'lng':-105.2852096557617},{'lat':40.0173454284668,'lng':-105.2852020263672},{'lat':40.01730728149414,'lng':-105.2851867675781},{'lat':40.01727294921875,'lng':-105.2851867675781},{'lat':40.01724243164062,'lng':-105.2851791381836},{'lat':40.01720809936523,'lng':-105.2851715087891},{'lat':40.01716995239258,'lng':-105.28515625},{'lat':40.01713943481445,'lng':-105.2851333618164},{'lat':40.01710891723633,'lng':-105.2851257324219},{'lat':40.0170783996582,'lng':-105.2851181030273},{'lat':40.01705169677734,'lng':-105.2851028442383},{'lat':40.01701736450195,'lng':-105.2850952148438},{'lat':40.01699447631836,'lng':-105.2850799560547},{'lat':40.0169677734375,'lng':-105.2850723266602},{'lat':40.01694488525391,'lng':-105.2850494384766},{'lat':40.01691436767578,'lng':-105.285026550293},{'lat':40.01689147949219,'lng':-105.2850112915039},{'lat':40.01687622070312,'lng':-105.2849655151367},{'lat':40.01686477661133,'lng':-105.2849197387695},{'lat':40.01686096191406,'lng':-105.2848892211914},{'lat':40.0168571472168,'lng':-105.2848434448242},{'lat':40.01686096191406,'lng':-105.2848052978516},{'lat':40.01686477661133,'lng':-105.2847595214844},{'lat':40.01687622070312,'lng':-105.2847213745117},{'lat':40.01688385009766,'lng':-105.2846755981445},{'lat':40.01689147949219,'lng':-105.2846298217773},{'lat':40.01689910888672,'lng':-105.2845916748047},{'lat':40.01691436767578,'lng':-105.2845458984375},{'lat':40.01692962646484,'lng':-105.2845001220703},{'lat':40.01693725585938,'lng':-105.2844696044922},{'lat':40.01694488525391,'lng':-105.2844314575195},{'lat':40.0169563293457,'lng':-105.2843856811523},{'lat':40.01696014404297,'lng':-105.2843399047852},{'lat':40.01697158813477,'lng':-105.284309387207},{'lat':40.01698303222656,'lng':-105.2842712402344},{'lat':40.01699829101562,'lng':-105.2842254638672},{'lat':40.01700592041016,'lng':-105.2841796875},{'lat':40.01701736450195,'lng':-105.2841415405273},{'lat':40.01702117919922,'lng':-105.2840957641602},{'lat':40.01702117919922,'lng':-105.284049987793},{'lat':40.01701736450195,'lng':-105.2840118408203},{'lat':40.01699829101562,'lng':-105.2839813232422},{'lat':40.01697158813477,'lng':-105.2839584350586},{'lat':40.01694107055664,'lng':-105.2839584350586},{'lat':40.01690673828125,'lng':-105.2839431762695},{'lat':40.01687240600586,'lng':-105.2839279174805},{'lat':40.01683807373047,'lng':-105.2839126586914},{'lat':40.01679992675781,'lng':-105.2839050292969},{'lat':40.01677322387695,'lng':-105.2838897705078},{'lat':40.01675033569336,'lng':-105.2838821411133},{'lat':40.01672744750977,'lng':-105.2838592529297},{'lat':40.01671981811523,'lng':-105.2838287353516},{'lat':40.01671600341797,'lng':-105.2837982177734},{'lat':40.0167121887207,'lng':-105.2837524414062},{'lat':40.01670455932617,'lng':-105.2837066650391},{'lat':40.01668548583984,'lng':-105.2836761474609},{'lat':40.01666259765625,'lng':-105.2836685180664},{'lat':40.01663589477539,'lng':-105.2836532592773},{'lat':40.0166130065918,'lng':-105.2836380004883},{'lat':40.01658630371094,'lng':-105.2836151123047},{'lat':40.01655578613281,'lng':-105.2835998535156},{'lat':40.01652908325195,'lng':-105.2835998535156},{'lat':40.01650619506836,'lng':-105.2835998535156},{'lat':40.01648330688477,'lng':-105.2835922241211},{'lat':40.01646041870117,'lng':-105.2835922241211},{'lat':40.01643753051758,'lng':-105.2835922241211},{'lat':40.01641082763672,'lng':-105.2835922241211}
    //     ];
    //     var senderSocket = new WebSocket('ws://stryd.dev:8089/ws?t=sender');
    //     var i = 0, distance = 0, time = 0;
    //     var index = 0;
    //     var iterator = function () {
    //         i++;
    //         index = i%data.length;
    //         data[index].power = parseInt(Math.random() * (300 - 200) + 200);
    //         data[index].heart_rate = parseInt(Math.random() * (180 - 120) + 120);
    //         data[index].time = 
    //         data[index].distance = 
    //         data[index].pace = 
    //         senderSocket.send(JSON.stringify(data[index]));
    //     };
    //     senderSocket.onopen = function (event) {
    //         setInterval(iterator, 500);
    //     };
    // };
    // fakeData();
});