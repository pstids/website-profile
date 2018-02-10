/*jshint -W079 */
/*jshint unused:false*/
/*global Dexie, FeatureManagement*/

/*
processor is a webworker than handles workout fetching.
It requests the data from the API and operates on it
for display.
*/
var processor = new Worker('/powercenter/scripts/processor.js');

var updatedTime = '';

/*
Creates a local storage database using Dexie.
Items are fetched using ID and the workout data
is stored as JSON in the storage.
Use db.log.clear() to wipe the storage for
testing.
*/
var db, initDB = function () {
	db = new Dexie('Logs');
	db.version(1).stores({
		log: '++id, data'
	});
	db.open();
};
initDB();

/*
toast is a helper function to set
and display toast messages to user
*/
var toastEle = null, toast = function (message) {
	if (toastEle !== null) {
		toastEle.text = message;
		toastEle.show();
	}
};

var app = document.querySelector('#app');

var bubbleStats,
	compareCalendar,
	header,
	homeNavigation,
	lapOverview,
	logCalendar,
	mapRunEle,
	performanceManagement,
	planView,
	rssPrimary,
	rssSecondary,
	settingsElement,
	uploader,
	workoutElement,
	workoutSummary,
	heatDuration,
	spiderChart,
	powerTrend;

var firstLoad = true;
var forceLoad = false;
var currentID = null;

// Listen for template bound event to know when bindings
// have resolved and content has been stamped to the page
app.addEventListener('dom-change', () => {
	console.log('Stryd is ready to rock!');

	bubbleStats = document.querySelector('bubble-stats');
	compareCalendar = document.querySelector('compare-calendar');
	header = document.querySelector('header-element');
	homeNavigation = document.querySelector('home-navigation');
	lapOverview = document.querySelector('lap-overview');
	logCalendar = document.querySelector('log-calendar');
	app.logOption = document.querySelector('log-options');
	mapRunEle = document.querySelector('#map-run');
	performanceManagement = document.querySelector('performance-management');
	planView = document.querySelector('plan-view');
	rssPrimary = document.querySelector('#rss-primary');
	rssSecondary = document.querySelector('#rss-secondary');
	settingsElement = document.querySelector('stryd-settings');
	toastEle = document.querySelector('#toast');
	uploader = document.querySelector('file-upload');
	workoutElement = document.querySelector('#workout-element');
	workoutSummary = document.querySelector('workout-summary');
	heatDuration = document.querySelector('heat-duration');
	spiderChart = document.querySelector('spider-chart');
	powerTrend = document.querySelector('power-trend');

	app.home = 'analysis';
	app.route = 'profile';

	window.mapReady = function () {
		mapRunEle.setReady();
	};

	app.loadMap();
	app.suuntoProcessing();

	processor.onmessage = (event) => {
		if ('error' in event.data && event.data.error === true) {
			toast('Cannot load workout! Visit the calendar to select another.');
			return;
		}

		app.checkUserFeatures();

		if ('mapRunData' in event.data) {
			mapRunEle.setData(event.data.mapRunData);
		}
		if ('chartDescription' in event.data) {
			lapOverview.getLaps(event.data.chartDescription.id);
		}
		if ('metrics' in event.data) {
			bubbleStats.setData(event.data.metrics);
		}
		if ('laps' in event.data) {
			lapOverview.displayLaps(event.data.laps);
		}
		if ('chartData' in event.data) {
			workoutSummary.setData(event.data.workout);
			workoutElement.setChartData(
				event.data.chartData,
				event.data.chartDescription,
				event.data.availableMetrics
			);
			planView.setStartTime(event.data.chartDescription.start_time);
		}
		if ('addLog' in event.data) {
			var activityDate = moment.unix(event.data.addLog.start_time);
			toast(`Workout from ${activityDate.format('MMMM Do YYYY')} uploaded!`);
			logCalendar.addActivity(event.data.addLog);
			compareCalendar.addActivity(event.data.addLog);
		}
		if ('comparison' in event.data) {
			rssPrimary.setChartData(
				event.data.activityPrimary,
				event.data.dataPrimary,
				event.data.maxPower,
				event.data.maxRSS
			);
			rssSecondary.setChartData(
				event.data.activitySecondary,
				event.data.dataSecondary,
				event.data.maxPower,
				event.data.maxRSS
			);
		}
		if ('updateLog' in event.data) {
			forceLoad = true;
		}
	};

	page.base('/powercenter');

	page('/', () => {
		if (jwt.hasToken) {
			page('/analysis');
			calendarManager.loadNew = true;
		} else {
			document.location = '/signin';
		}
	});

	page('/analysis', () => {
		if (jwt.hasToken) {
			app.route = 'profile';
			header.toggleActive('profile');
			calendarManager.loadFirst();
		} else {
			document.location = '/signin';
		}
	});

	page('/improve', () => {
		if (jwt.hasToken) {
			app.route = 'improve';
			header.toggleActive('improve');
		} else {
			document.location = '/signin';
		}
	});

	page('/trends', () => {
		if (jwt.hasToken) {
			app.route = 'improve';
			header.toggleActive('improve');
			powerTrend.scrollIntoView();
		} else {
			document.location = '/signin';
		}
	});

	page('/run/:idPrimary/run/:idSecondary', (data) => {
		app.route = 'profile';
		app.params = data.params;
		app.home = 'comparison';
		header.toggleActive('profile');
		homeNavigation.select('comparison');

		processor.postMessage({
			token: jwt.token,
			type: 'workoutComparison',
			params: data.params,
			updated_time: updatedTime
		});

		if (firstLoad) {
			urlManager.setNavigation(+app.params.idPrimary, 0);
			urlManager.compareID = +app.params.idSecondary;
			firstLoad = false;
		} else {
			window.scrollTo(0, document.querySelector('#workout-holder').offsetTop);
		}
		logCalendar.setActive(+app.params.idPrimary);
		compareCalendar.setActive(+app.params.idPrimary);
		if (!workoutSummary.hasWorkout) {
			app.workoutFetching(app.params.idPrimary);
			currentID = app.params.idPrimary;
		}
	});

	page('/run/:id', (data) => {
		app.route = 'profile';
		app.params = data.params;
		app.home = 'analysis';
		header.toggleActive('profile');
		homeNavigation.select('analysis');

		logCalendar.setActive(+app.params.id);

		mapRunEle.classList.remove('hidden');
		mapRunEle.resizeMap();
		workoutElement.switchMetric('power', 'on');
		workoutElement.classList.remove('hidden');
		lapOverview.classList.remove('hidden');

		if (firstLoad) {
			urlManager.setNavigation(app.params.id, 0);
			firstLoad = false;
		} else {
			window.scrollTo(0, document.querySelector('#workout-holder').offsetTop);
		}

		if (currentID !== app.params.id || forceLoad) {
			workoutElement.setLoading();
			currentID = app.params.id;
			app.workoutFetching(currentID);
			forceLoad = false;
		}
		workoutElement.toggleView();
	});

	page('/training/:hash', (data) => {
		app.params = data.params;
		app.route = 'profile';
		app.home = 'training';
		header.toggleActive('profile');

		if (firstLoad) {
			urlManager.setNavigation(0, app.params.hash);
			firstLoad = false;
		} else {
			window.scrollTo(0, document.querySelector('#workout-holder').offsetTop);
		}

		planView.chartToggle(true);
		planView.setStartHash(data.params.hash);
		planView.classList.add('hasWorkout');
	});

	page('/settings', () => {
		if (jwt.hasToken) {
			app.route = 'settings';
			header.toggleActive('settings');
			settingsElement.toggle('profile');
		} else {
			document.location = '/signin';
		}
	});

	page('/connect', () => {
		if (jwt.hasToken) {
			app.route = 'settings';
			header.toggleActive('settings');
			settingsElement.toggle('connect');
		} else {
			document.location = '/signin';
		}
	});

	page('/zones', () => {
		if (jwt.hasToken) {
			app.route = 'settings';
			header.toggleActive('settings');
			settingsElement.toggle('zone');
		} else {
			document.location = '/signin';
		}
	});

	page('/leaderboard', () => {
		if (jwt.hasToken) {
			app.route = 'leaderboard';
			header.toggleActive('leaderboard');
			ga('send', 'event', 'view', 'leaderboard');
		} else {
			document.location = '/signin';
		}
	});

	page('/a/:name', (data) => {
		if (jwt.hasToken) {
			calendarManager.loadNew = true;
			calendarManager.setAdmin(data.params.name);
			page('/analysis');
		} else {
			document.location = '/signin';
		}
	});

	page('/plan', () => {
		if (jwt.hasToken) {
			app.route = 'plan';
		} else {
			document.location = '/signin';
		}
	});

	page('/plan/:id', (data) => {
		app.route = 'new-plan';
		app.planID = data.params.id;
	});

	page('/plan/:id/detail', (data) => {
		app.route = 'plan-detail';
		app.planID = data.params.id;
	});

	page('/efficiency', () => {
		app.route = 'profile';
		header.toggleActive('profile');
		workoutSummary.setEfficiency();
		page('/run/4951793020698624');
	});

	page('*', () => {
		document.location = '/signin';
	});

	page({
		hashbang: false
	});

	if (featureManagement.hasFeatures) {
		// document.querySelector('[data-route="improve"]').appendChild(
		// 	document.querySelector('performance-management')
		// );
		bubbleStats.giveToggle();
	}
});

app.logout = function () {
	jwt.logout();
};

app.checkUserFeatures = function () {
	if (!jwt.hasToken) {
		logCalendar.classList.add('hidden');
		uploader.classList.add('hidden');
		performanceManagement.classList.add('hidden');
	} else {
		logCalendar.classList.remove('hidden');
		uploader.classList.remove('hidden');
		performanceManagement.classList.remove('hidden');
	}
};

app.loadMap = function () {
	var mapScript = document.createElement('script');
	mapScript.src = 'https://maps.googleapis.com/maps/api/js?key=AIzaSyC-D84ZWKQT9kbZ8meKUu1yvklQUtWRiOg&callback=mapReady';
	mapScript.async = true;
	mapScript.defer = true;
	document.body.appendChild(mapScript);
};

app.suuntoProcessing = function () {
	processor.postMessage({
		token: jwt.token,
		type: 'suuntoProcessing'
	});
};

app.calcMetrics = function (start, end, activityID, unit) {
	processor.postMessage({
		type: 'metrics',
		start: start,
		end: end,
		activityID: activityID,
		unit: unit
	});
};

app.setDownload = function (url) {
	document.querySelector('#dlFrame').src = url;
};

app.giveActivities = function (activities) {
	if (logCalendar) {
		logCalendar.processActivities(activities);
	}
};

app.giveActivities2 = function (activities) {
	if (compareCalendar) {
		compareCalendar.processActivities(activities);
	}
};

app.setHomeNavigation = function (availables) {
	homeNavigation.setAvailable(availables);
};

app.showLaps = function (status) {
	if (!status) {
		lapOverview.classList.remove('hidden');
	} else {
		lapOverview.classList.remove('hidden');
	}
};

/*
updateWorkout is a helper function.
It updates the local databases with
new information and updates the server.
{
	id: the id of the activity,
	updates: json object with updates keys and fields,
	cb: callback function for execution on
		server response
}
*/
app.updateWorkout = function (id, updates, cb) {
	superagent
		.put(`/b/api/v1/activities/${id}`)
		.send(updates)
		.set('Authorization', `Bearer: ${jwt.token}`)
		.end(cb);

	db.log.get(String(id), (log) => {
		if (log !== undefined) {
			for (var key in updates) {
				log.data[key] = updates[key];
			}
			db.log.put({
				id: String(log.id),
				data: log.data
			});
		}
	});

	toast('Activity updated!');
};

/*
workoutFetching grabs a workout by ID and
sends the content to workout-element, map-run, and
workout-shared.
{
	id: id of the activity,
	updated_time: a value parsable by new Date()
}
*/
app.workoutFetching = function (id) {
	processor.postMessage({
		token: jwt.token,
		type: 'workout',
		id: id,
		updated_time: updatedTime
	});
};

app.addLog = function (id) {
	processor.postMessage({
		token: jwt.token,
		type: 'addLog',
		id: id
	});
};

app.logsFetching = function () {
	processor.postMessage({
		token: jwt.token,
		type: 'all'
	});
};

app.lapProcessing = function (id, lapMarker) {
	var data = {
		type: 'laps',
		activityID: id,
		lapMarker: lapMarker,
		unit: user.data.units
	};
	if (user && 'data' in user && 'training_info' in user.data) {
		data.zones = user.data.training_info.training_zones;
	} else {
		data.zones = null;
	}
	processor.postMessage(data);
};

app.addGuide = function (from, to, zone) {
	workoutElement.addGuide(from, to, zone);
};

app.clearChildren = function (parent) {
	while (Polymer.dom(parent).firstChild) {
		Polymer.dom(parent).removeChild(Polymer.dom(parent).firstChild);
	}
};