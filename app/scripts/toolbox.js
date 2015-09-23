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

// Return pace in minutes per mile from meters per second
var minutesPerMile = function (mps, opt) {
    if (mps === 0) {
        return 0;
    }
    var mpm = parseFloat(mps * (1609.34/60)).toFixed(2);
    if (opt && opt === 'minutes') {
        var minutes = Math.floor(mpm);
        var secondPartial = ((mpm - minutes) * 60).toPrecision(2);
        mpm = minutes + ':' + secondPartial;
    }
    return mpm;
};

// Return minutes per miles with unit
var speedToPaceForBalloon = function (graphDataItem, graph) {
    var value = graphDataItem.values.value;
    return minutesPerMile(value) + ' Min/Mile';
};

// Wrapper for minutesPerMile function
var speedToPaceForValueAxis = function (value, formattedValue, valueAxis) {
    return minutesPerMile(value);
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
var meterToMile = function (m) {
    return (m/1600).toFixed(1);
};