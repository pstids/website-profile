/*jshint -W079 */
/*jshint unused:false*/

// Return to one decimal place for statistics
Number.prototype.stat = function () {
    return this.toFixed(1);
};

// Return to one decimal place for statistics
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

// Prepend 0 to single digit values
var fillZero = function (n) {
    n = String(n);
    if (n.length === 1) {
        return '0' + n;
    } else {
        return n;
    }
};

// Decimal pace to readable pace
var formatPace = function (pace) {
    var paceFloat = parseFloat(pace);
    if (pace === 'Infinity' || isNaN(pace) || paceFloat > 100 || paceFloat < 1) {
        return '--:--';
    }
    var floor = Math.floor(paceFloat);
    var seconds = ((paceFloat - floor) * 60).toFixed(0);
    var secondsFilled = fillZero(seconds);
    return floor + ':' + secondsFilled;
};

// Creates date object from milliseconds
var setDate = function (ms) {
    return new Date(ms * 1000);
};

// Returns time in HH:MM:SS format
var hmsTime = function (s) {
    var time = new Date(s);
    return fillZero(time.getUTCHours()) + ':' + fillZero(time.getMinutes()) + ':' + fillZero(time.getSeconds());
};

// Returns total run time
var hrTime = function (s) {
    var time = new Date(s);
    var hrsRun = (time.getUTCHours() + time.getMinutes() / 60 + time.getSeconds() / 3600);
    return hrsRun.toFixed(1);
};

// Converts meters to kilometers
var meterToKM = function (m) {
    return (m/1000).toFixed(1);
};

// Converts meters to miles
var meterToMile = function (m, precision) {
    if (precision) {
        return (m/1600).toFixed(precision);
    }
    return (m/1600).toFixed(1);
};

var meterToUserUnit = function (m) {
    if (user.data.units === 'feet') {
        var mi = meterToMile(m, 0);
        return `${mi} mi`;
    } else {
        var km = meterToKM(m);
        return `${km} km`;
    }
};

// Return minutes per miles with unit
var speedToPaceForBalloon = function (graphDataItem, graph) {
    var value = graphDataItem.values.value;
    var unitLabel = ' Min/KM';
    if (user.data.units === 'feet') {
        unitLabel = ' Min/Mile';
    }
    return speedToPace(value, user.data.units) + unitLabel;
};

// Wrapper for speedToPace function
var speedToPaceForValueAxis = function (value, formattedValue, valueAxis) {
    return speedToPaceInDecimal(value, user.data.units);
};

var speedToPaceInDecimal = function (mps, unit) {
    var dist = 1000;
    if (unit === 'feet') {
        dist = 1609.34;
    }
    return dist/mps/60;
};

var speedToPace = function (mps, unit) {
    if (mps === 0 || isNaN(mps)) {
        return '--:--';
    }
    return formatPace(speedToPaceInDecimal(mps, unit));
};

// Convert duration string to duration in seconds. Return -1 if input is invalid
var durationToSec = function (paceStr) {
    let items = paceStr.split(':');
    if (items.length !== 2) {
        return -1;
    }
    let minute = parseInt(items[0]);
    let second = parseInt(items[1]);
    if (isNaN(minute) || isNaN(second)) {
        return -1;
    }
    return minute * 60 + second;
};

var attribute = function (selector, parent) {
  var eles = parent.querySelectorAll('[data-' + selector + ']');
  var holder = {};
  for (var i = 0; i < eles.length; i++) {
    holder[eles[i].dataset[selector]] = eles[i];
  }
  return holder;
};

var arraysEqual = function (a, b) {
    if (a === b) {
        return true;
    }
    if (a === null || b === null) {
        return false;
    }
    if (a.length !== b.length) {
        return false;
    }

    a.sort();
    b.sort();
    for (var i = 0; i < a.length; ++i) {
        if (a[i] !== b[i]) {
            return false;
        }
    }
    return true;
};
