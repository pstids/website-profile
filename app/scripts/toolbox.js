/*jshint -W079 */
/*jshint unused:false*/

// Return to one decimal place for statistics
Number.prototype.stat = function () {
	return this.toFixed(1);
};

// Return to one decimal place for statistics
String.prototype.stat = function () {
	return String(this).split('.')[0];
};

String.prototype.fill = function () {
	var x = String(this);
	if (x.length === 1) {
		return `0${x}`;
	} else {
		return x;
	}
};

Number.prototype.fill = function () {
	var x = String(this);
	if (x.length === 1) {
		return `0${x}`;
	} else {
		return x;
	}
};

// Creates date object from milliseconds
var setDate = function (ms) {
	return new Date(ms * 1000);
};

// Returns time in HH:MM:SS format
var hmsTime = function (s) {
	var time = new Date(s);
	var hours = time.getUTCHours().fill();
	var minutes = time.getMinutes().fill();
	var seconds = time.getSeconds().fill();
	return `${hours}:${minutes}:${seconds}`;
};

// Returns total run time
var hrTime = function (s) {
	var time = new Date(s);
	var hrsRun = (time.getUTCHours() + time.getMinutes() / 60 + time.getSeconds() / 3600);
	return hrsRun.toFixed(1);
};

class Unit {
	constructor() {
		this.metersPerMile = 1609.34;
		this.metersPerKM = 1000;
		this.metersPerFoot = 3.28084;
	}
	// return meters to mi or km fix 1
	distanceValue(value, unit) {
		if (unit === 'feet') {
			return this.metersToMile(value);
		} else {
			return this.metersToKM(value);
		}
	}
	// return meters to mi or km
	distanceValueRaw(value, unit) {
		if (unit === 'feet') {
			return value/this.metersPerMile;
		} else {
			return value/this.metersPerKM;
		}
	}
	// return distane unit
	distanceUnit (unit) {
		if (unit === 'feet') {
			return 'mi';
		} else {
			return 'km';
		}
	}
	// meters to miles
	metersToMile(value) {
		return parseFloat((value/this.metersPerMile).toFixed(1));
	}
	// meters to kms
	metersToKM(value) {
		return parseFloat((value/this.metersPerKM).toFixed(1));
	}
	// meters per second to units/min (MM:SS)
	speedValue(value, unit) {
		if (value === 0 || isNaN(value)) {
			return '--:--';
		}
		return this.paceFormat(this.speedDecimal(value, unit));
	}
	// return speed unit
	speedUnit(unit) {
		if (unit === 'feet') {
			return '/mi';
		} else {
			return '/km';
		}
	}
	// meters per second to units/min (MM.SS/60)
	speedDecimal(value, unit) {
		var distancePerUnit = this.metersPerKM;
		if (unit === 'feet') {
			distancePerUnit = this.metersPerMile;
		}
		return (distancePerUnit/value/60).toFixed(1);
	}
	// units/min (MM.SS/60) to units/min (MM:SS)
	paceFormat(pace) {
		var paceFloat = parseFloat(pace);
		if (pace === 'Infinity' || isNaN(pace) || paceFloat > 100 || paceFloat < 1) {
			return '--:--';
		}
		var floor = Math.floor(paceFloat);
		var seconds = (paceFloat - floor) * 60;
		if (seconds === 60) {
			seconds = 0;
			floor++;
		}
		var secondsFilled = Math.floor(seconds).fill();
		return `${floor}:${secondsFilled}`;
	}
	elevationValue(value, unit) {
		if (unit === 'feet') {
			return (value * this.metersPerFoot).toFixed(1);
		} else {
			return value.toFixed(1);
		}
	}
	elevationUnit(unit) {
		if (unit === 'feet') {
			return 'Feet';
		} else {
			return 'Meters';
		}
	}
}

var unit = new Unit();

// Convert duration string to duration in seconds. Return -1 if input is invalid
var durationToSec = function (paceStr) {
	if (paceStr === undefined) {
		return 0;
	}
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

var secToDurationFull = function (sec) {
	var hrs = Math.floor(sec/3600);
	var hrStr = hrs.fill();
	var rSec = sec - (hrs * 3600);
	var minStr = Math.floor(rSec / 60).fill();
	var secStr = Math.floor(rSec % 60).toFixed(0).fill();
	return `${hrStr}:${minStr}:${secStr}`;
};

var secToDuration = function (sec) {
	if (sec > 3600) {
		return secToDurationFull(sec);
	}
	var minStr = Math.floor(sec / 60).fill();
	var secStr = (sec % 60).toFixed(0).fill();
	return `${minStr}:${secStr}`;
};

var attribute = function (selector, parent) {
	var eles = parent.querySelectorAll(`[data-${selector}]`);
	var holder = {};
	for (var ele of eles) {
		holder[ele.dataset[selector]] = ele;
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

(function() {
	function decimalAdjust(type, value, exp) {
		// If the exp is undefined or zero...
		if (typeof exp === 'undefined' || +exp === 0) {
			return Math[type](value);
		}
		value = +value;
		exp = +exp;
		// If the value is not a number or the exp is not an integer...
		if (isNaN(value) || !(typeof exp === 'number' && exp % 1 === 0)) {
			return NaN;
		}
		// If the value is negative...
		if (value < 0) {
			return -decimalAdjust(type, -value, exp);
		}
		// Shift
		value = value.toString().split('e');
		value = Math[type](+(value[0] + 'e' + (value[1] ? (+value[1] - exp) : -exp)));
		// Shift back
		value = value.toString().split('e');
		return +(value[0] + 'e' + (value[1] ? (+value[1] + exp) : exp));
	}

	// Decimal round
	if (!Math.round10) {
		Math.round10 = function(value, exp) {
			return decimalAdjust('round', value, exp);
		};
	}
	// Decimal floor
	if (!Math.floor10) {
		Math.floor10 = function(value, exp) {
			return decimalAdjust('floor', value, exp);
		};
	}
	// Decimal ceil
	if (!Math.ceil10) {
		Math.ceil10 = function(value, exp) {
			return decimalAdjust('ceil', value, exp);
		};
	}
})();