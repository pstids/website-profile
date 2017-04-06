/*jshint -W079 */
/*jshint unused: false*/
/*global CryptoJS*/
/*global processor*/

var isLocal = false;
if (window.location.hostname === 'stryd.dev') {
	isLocal = true;
}

class JWT {
	constructor() {
		this.token = localStorage.getItem('token');
		this.data = {
			id: 0
		};
		this.hasToken = false;
		this.checkToken();
	}

	checkToken() {
		if (!this.token) {
			console.log('No token present!');
			this.token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJlbWFpbCI6Imd1ZXN0QHN0cnlkLmNvbSIsImV4cCI6NDYwNDk2MjEwMTk1NiwiZmlyc3RuYW1lIjoiU3RyeWQiLCJpZCI6Ii0xIiwiaW1hZ2UiOiIiLCJsYXN0bmFtZSI6IlJ1bm5lciIsInVzZXJuYW1lIjoiZ3Vlc3QifQ.jlm3nYOYP_L9r8vpOB0SOGnj5t9i8FWwpn5UxOfar1M';
		} else {
			this.hasToken = true;
			this.parseData();
		}
	}

	setToken(token) {
		localStorage.setItem('token', token);
	}

	parseData() {
		var blocks = this.token.split('.');
		this.data = JSON.parse(atob(blocks[1].replace(/\s/g, '')));
		for (var key in this.data) {
			this.data[key.toLowerCase()] = this.data[key];
		}
	}

	checkRenewal() {
		if ('exp' in this.data && this.data.exp < Date.now()) {
			this.requestToken();
		} else if (!('exp' in this.data)) {
			this.requestToken();
		}
	}

	requestToken() {
		if ('id' in this.data) {
			superagent
				.post('/b/token/renew')
				.send({
					token: this.token
				})
				.set('Accept', 'application/json')
				.end((err, res) => {
					if (res.ok) {
						localStorage.setItem('token', res.body.token);
						this.constructor();
					} else {
						this.logout();
					}
				});
		} else {
			this.logout();
		}
	}

	removeToken() {
		this.hasToken = false;
		localStorage.removeItem('token');
	}

	logout() {
		this.removeToken();
		location.pathname = '/signin';
	}
}

var jwt = new JWT();

class User {
	constructor() {
		this.storage = localStorage.getItem('user');
		// Put default data for newly created users
		this.data = {};
		this.checkStorage();
	}

	get(path) {
		if (!(path in this.data) || this.data[path] === null) {
			this.data[path] = null;
			this.fetchDetails(true);
		}
		return this.data[path];
	}

	getImage() {
		this.defaultURL = 'https://www.stryd.com/powercenter/images/favicon.png';
		if ('profile_medium' in this.data && this.data.profile_medium !== '') {
			return this.data.profile_medium;
		} else if ('email' in this.data && this.data.email !== '') {
			var gravHash = CryptoJS.MD5(this.data.email.toLowerCase());
			return `http://www.gravatar.com/avatar/${gravHash}?d=${this.defaultURL}`;
		} else {
			return this.defaultURL;
		}
	}

	getData() {
		this.data.available = jwt.hasToken;
		return this.data;
	}

	checkStorage() {
		if (this.storage === null || this.storage === 'null') {
			this.fetchDetails(true);
		} else {
			this.parseData();
		}
	}

	updateData(data) {
		if (data !== null) {
			this.data = data;
			localStorage.setItem('user', JSON.stringify(data));
		}
	}

	clearData() {
		localStorage.removeItem('user');
	}

	parseData() {
		this.data = JSON.parse(this.storage);
	}

	fetchDetails(callback) {
		var that = this;
		if (jwt.data.id === 0) {
			return;
		}
		superagent
			.get(`/b/api/v1/users/${jwt.data.id}`)
			.send()
			.set('Accept', 'application/json')
			.set('Authorization', `Bearer: ${jwt.token}`)
			.end((err, res) => {
				if (res.ok) {
					localStorage.setItem('user', JSON.stringify(res.body));
					if (callback) {
						if (typeof callback === 'object') {
							callback();
							return;
						}
						location.reload();
					}
					that.constructor();
				} else {
					console.log('Error: Setting user information');
				}
			});
	}
}

var user = new User();

class TrainingPlan {
	constructor() {
		this.plan = {};
		this.days = {};
		this.hasPlan = false;

		this.targetDate = moment();

		/* Check for local plan and store in user account */
		var trainingSelected;
		if (isLocal) {
			trainingSelected = localStorage.getItem('training-selected');
			var trainingStarted = localStorage.getItem('training-started');
			var trainingParsed = moment(trainingStarted, 'YYYYMMDD').format('X');
			if (trainingSelected !== null && trainingStarted !== null) {
				superagent
					.post(`/b/api/v1/users/plan?id=${trainingSelected}&start_date=${trainingParsed}`)
					.set('Accept', 'application/json')
					.set('Authorization', `Bearer: ${jwt.token}`)
					.end((err, res) => {
						if (res !== undefined && res.ok && res.body !== null) {
							localStorage.removeItem('training-selected');
							localStorage.removeItem('training-started');
							window.location.reload();
						} else {
							console.log('Error: failure to set training plan1', err);
						}
					});
			}
		}

		if (isLocal) {
			trainingSelected = localStorage.getItem('training-selected');
			if (trainingSelected !== null && localStorage.getItem('training-started') !== null) {
				this.targetDateHash = localStorage.getItem('training-started');
				superagent
					.get('/powercenter/scripts/plan.json')
					.set('Accept', 'application/json')
					.end((err, res) => {
						if (res !== undefined && res.ok && res.body !== null) {
							this.plan = res.body.plan;
							this.hasPlan = true;
							this.processPlan();
						} else {
							console.log('Error: failure to get training plan2', err);
						}
					});
			}
		} else {
			superagent
				.get('/b/api/v1/users/plan')
				.set('Accept', 'application/json')
				.set('Authorization', `Bearer: ${jwt.token}`)
				.end((err, res) => {
					if (res !== undefined && res.ok && res.body !== null) {
						this.plan = res.body.training_plan;
						this.hasPlan = true;
						this.targetDate = moment(res.body.training_plan_start_date);
						this.targetDateHash = this.targetDate.format('YYYYMMDD');
						this.processPlan();
					} else {
						console.log('Error: failure to get training plan', err);
					}
				});
		}
	}

	processPlan() {
		for (var workout of this.plan.workouts) {
			var addDays = workout.workout_day;
			var targetDate = moment(this.targetDateHash).add(addDays, 'days');
			var dateHash = targetDate.format('YYYYMMDD');
			var rss = this.getRSS(workout);
			workout.rss = rss;
			this.days[dateHash] = workout;
		}
	}

	getRSS(workout) {
		var baseSpd = 6;
		var relativeIntensities = [0.8, 0.85, 0.95, 1.1 ,1.25];
		var blocks = workout.blocks;
		var totalStress = 0;
		var stress = 0;
		for (var block of blocks) {
			var segments = block.segments;
			var repeat = block.block_repeat;
			if (repeat === 0) {
				repeat = 1;
			}
			for (var segment of segments) {
				for (var i = 0; i < repeat; i++) {
					var zone = segment.zone_selected;
					var relativeIntensity = 0;
					var zonePercent = segment.intensity_percent;
					if (zonePercent.high > 0) {
						relativeIntensity = 0.01 * (zonePercent.high/2 + zonePercent.low/2);
					} else {
						relativeIntensity = relativeIntensities[zone];
					}

					var distanceMeters = 0;
					if (segment.duration_distance > 50) {
						segment.distance_unit_selected = 'meter';
					}
					if (segment.distance_unit_selected === 'mile') {
						distanceMeters = unit.metersPerMile * segment.duration_distance;
					} else if (segment.distance_unit_selected === 'meter') {
						distanceMeters = segment.duration_distance;
					} else if (segment.distance_unit_selected === 'km') {
						distanceMeters = unit.metersPerKM * segment.duration_distance;
					}

					var durationSeconds = 0;
					var adjSpd = 0;
					if (segment.duration_type === 'time') {
						if (segment.duration_time.hour === 0 && segment.duration_time.minute === 10 && segment.duration_time.second === 0) {
							segment.duration_time.minute = 0;
							segment.duration_time.second = 10;
						}
						durationSeconds = segment.duration_time.hour*3600 + segment.duration_time.minute*60 + segment.duration_time.second;
						distanceMeters = durationSeconds * relativeIntensity * baseSpd;
					} else {
						if (distanceMeters > 0) {
							adjSpd = relativeIntensity * baseSpd;
							durationSeconds = distanceMeters / adjSpd;
						} else {
							adjSpd = 0;
							durationSeconds = 0;
						}
					}

					stress = 1.8 * durationSeconds/60 * Math.pow(relativeIntensity, 3.5);
					totalStress = totalStress + stress;
				}
			}
		}
		return totalStress.toFixed(0);
	}

	getDay(dateStr) {
		if (dateStr in this.days) {
			return this.days[dateStr];
		} else {
			return null;
		}
	}
}

var trainingPlan = new TrainingPlan();

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
		this.threshold = {
			range: 200,
			high: 400,
			low: 200
		};
	}
	interpolate(start, end, steps, count) {
		var final = start + (((end - start) / steps) * count);
		return Math.floor(final);
	}
	RGB(relativePower) {
		var r = this.interpolate(
			this.lowColorRGB.r,
			this.highColorRGB.r,
			this.threshold.range,
			relativePower
		);
		var g = this.interpolate(
			this.lowColorRGB.g,
			this.highColorRGB.g,
			this.threshold.range,
			relativePower
		);
		var b = this.interpolate(
			this.lowColorRGB.b,
			this.highColorRGB.b,
			this.threshold.range,
			relativePower
		);
		return `rgb(${r}, ${g}, ${b})`;
	}
}

var colorInterpolate = new ColorInterpolate();

class URLManager {
	constructor() {
		this.activityID = 0;
		this.trainingID = 0;
		this.compareID = 0;
		this.availables = [];

		this.mode = null;
	}
	setURL(activityID, trainingID) {
		this.activityID = activityID;
		this.trainingID = trainingID;
		this.setNavigation(activityID, trainingID);
		if (this.activityID !== 0) {
			this.mode = 'analysis';
			page(`/run/${this.activityID}`);
		} else if (this.trainingID !== 0) {
			this.mode = 'training';
			page(`/training/${this.trainingID}`);
		}
	}
	setNavigation(activityID, trainingID) {
		this.availables = [];
		this.activityID = activityID;
		if (this.activityID !== 0) {
			this.availables.push('analysis', 'laps', 'comparison');
		}
		if (trainingID !== 0) {
			this.availables.push('training');
		}
		app.setHomeNavigation(this.availables);
	}
	compareRun(compareID) {
		if (compareID !== null) {
			this.compareID = compareID;
		}
		if (this.activityID === 0) {
			this.activityID = compareID;
		}
		if (this.activityID !== 0 && this.compareID !== 0) {
			page(`/run/${this.activityID}/run/${this.compareID}`);
		} else {
			page(`/run/${this.activityID}`);
		}
	}
	view(select) {
		if (select === 'analysis') {
			this.mode = 'analysis';
			page(`/run/${this.activityID}`);
		} else if (select === 'comparison') {
			this.mode = 'comparison';
			page(`/run/${this.activityID}/run/${this.compareID}`);
		} else if (select === 'training') {
			this.mode = 'training';
			page(`/training/${this.trainingID}`);
		} else if (select === 'similar') {
			page(`/run/${this.activityID}/similar`);
		}
	}
}

var urlManager = new URLManager();

class CalendarManager {
	constructor() {
		this.dateSpan = {
			start: moment('2016-06-01'),
			end: moment().add(2, 'days')
		};
		this.activities = {};
		this.hasActivities = false;
		this.lastActivity = 0;
		this.loadNew = false;
		this.hasLoadNew = false;
		this.mode = 'user';
		this.username = '';
		var srtDate = this.dateSpan.start.format('MM-DD-YYYY');
		var endDate = this.dateSpan.end.format('MM-DD-YYYY');
		var activityEndPoint = `/b/api/v1/activities/calendar?srtDate=${srtDate}&endDate=${endDate}&sortBy=StartDate`;

		this.gotActivityEvent = new CustomEvent('gotActivities');
		superagent
			.get(activityEndPoint)
			.send()
			.set('Accept', 'application/json')
			.set('Authorization', `Bearer: ${jwt.token}`)
			.end((err, res) => {
				if (res.ok) {
					if (res.body !== null && res.body.activities !== null) {
						this.saveActivities(res.body.activities);
						this.lastActivity = res.body.last_activity;
						window.dispatchEvent(this.gotActivityEvent);
						this.hasLoadNew = true;
						if (this.loadNew) {
							this.loadLast();
						}
					} else {
						this.saveActivities([]);
						this.lastActivity = res.body.last_activity;
						this.loadLast();
					}
				} else {
					console.log('Error: failure on grabLogs', err, res);
				}
			});
	}
	setAdmin(username) {
		this.dateSpan = {
			start: moment('2016-06-01'),
			end: moment().add(2, 'days')
		};
		this.mode = 'admin';
		this.username = username;
		var srtDate = this.dateSpan.start.format('MM-DD-YYYY');
		var endDate = this.dateSpan.end.format('MM-DD-YYYY');
		var activityEndPoint = `/b/admin/users/${this.username}/activities/calendar?srtDate=${srtDate}&endDate=${endDate}&sortBy=StartDate`;
		superagent
			.get(activityEndPoint)
			.send()
			.set('Accept', 'application/json')
			.set('Authorization', `Bearer: ${jwt.token}`)
			.end((err, res) => {
				if (res.ok) {
					if (res.body !== null && res.body.activities !== null) {
						this.activities = {};
						this.saveActivities(res.body.activities);
						this.lastActivity = res.body.last_activity;
						window.dispatchEvent(this.gotActivityEvent);
						this.hasLoadNew = true;
						this.loadNew = true;
						if (this.loadNew) {
							this.loadLast();
						}
					} else {
						this.saveActivities([]);
						this.lastActivity = res.body.last_activity;
						this.loadLast();
					}
				} else {
					console.log('Error: failure on grabLogs', err, res);
				}
			});
	}
	loadFirst() {
		this.loadNew = true;
		if (this.hasLoadNew) {
			this.loadLast();
		}
	}
	saveActivities(activities) {
		for (var activity of activities) {
			if (!(activity.timestamp in this.activities)) {
				this.activities[activity.timestamp] = activity;
			}
		}
	}
	getMoreActivities(start, end) {
		if (this.dateSpan.start > start) {
			this.dateSpan.start = start;
		}
		if (this.dateSpan.end < end) {
			this.dateSpan.end = end;
		}
		var srtDate = start.format('MM-DD-YYYY');
		var endDate = end.format('MM-DD-YYYY');
		var activityEndPoint = `/b/api/v1/activities/calendar?srtDate=${srtDate}&endDate=${endDate}&sortBy=StartDate`;
		if (this.mode === 'admin') {
			activityEndPoint = `/b/admin/users/${this.username}/activities/calendar?srtDate=${srtDate}&endDate=${endDate}&sortBy=StartDate`;
		}
		superagent
			.get(activityEndPoint)
			.send()
			.set('Accept', 'application/json')
			.set('Authorization', `Bearer: ${jwt.token}`)
			.end((err, res) => {
				if (res.ok) {
					if (res.body !== null && res.body.activities !== null) {
						this.saveActivities(res.body.activities);
						this.requestActivities(start, end);
					} else {
						this.saveActivities([]);
						this.requestActivities(start, end);
					}
				} else {
					console.log('Error: failure on grabLogs', err, res);
				}
			});
	}
	requestActivities(start, end) {
		if (this.dateSpan.start <= start && this.dateSpan.end >= end) {
			var results = [];
			for (var timestamp of Object.keys(this.activities)) {
				var compareDate = moment(+timestamp * 1000);
				if (compareDate > start && compareDate < end) {
					results.push(this.activities[timestamp]);
				}
			}
			this.giveActivities(results);
		} else {
			this.getMoreActivities(start, end);
		}
	}
	requestActivities2(start, end) {
		if (this.dateSpan.start <= start && this.dateSpan.end >= end) {
			var results = [];
			for (var timestamp of Object.keys(this.activities)) {
				var compareDate = moment(+timestamp * 1000);
				if (compareDate > start && compareDate < end) {
					results.push(this.activities[timestamp]);
				}
			}
			this.giveActivities2(results);
		}
	}
	getPMActivities() {
		var start = moment().subtract(7, 'months');
		var end = moment().add(2, 'days');
		var results = [];
		for (var timestamp of Object.keys(this.activities)) {
			var compareDate = moment(+timestamp * 1000);
			if (compareDate > start && compareDate < end) {
				results.push(this.activities[timestamp]);
			}
		}
		return results;
	}
	getLOActivities(start, end) {
		var results = [];
		for (var timestamp of Object.keys(this.activities)) {
			var compareDate = moment(+timestamp * 1000);
			if (compareDate > start && compareDate < end) {
				results.push(this.activities[timestamp]);
			}
		}
		return results;
	}
	giveActivities(results) {
		app.giveActivities(results);
	}
	giveActivities2(results) {
		app.giveActivities2(results);
	}
	loadLast() {
		page(`/powercenter/run/${this.lastActivity}`);
		this.hasLoaded = true;
	}

	recalculateActivity(id) {
		processor.postMessage({
			token: jwt.token,
			type: 'updateLog',
			id: id
		});
	}
	removeActivity() {

	}
	addActivity(id) {
		processor.postMessage({
			token: jwt.token,
			type: 'addLog',
			id: id
		});
	}
}

var calendarManager = new CalendarManager();

class FeatureManagement {
	constructor() {
		this.usernames = [
			'angus',
			'angus-nelson',
			'kun',
			'jamie',
			'wyatt',
			'adamheaney',
			'emelie',
			'test12',
			'test11',
			'test',
			'gus-pernetz',
			'mcbevil',
			'firegirlred',
			'blue-angel',
			'sean-olson',
			'ron-van-megen',
			'eld0rado',
			'gus-pernetz',
			'schinpe',
			'alang',
			'nestorreyes3',
			'spenso',
			'johnschneider',
			'mikebisson',
			'riverlander',
			'robertjackson',
			'guido23',
			'joelmh',
			'ahardwick',
			'rinaldo',
			'felipe-araya',
			'1shammond',
			'johnoregan777',
			'adam-taylor',
			'sjoerd-mulder',
			'brian-reeds',
			'david-juiliano',
			'imarling',
			'murph',
			'runnerizer',
			'jzahavich',
			'glen-smetherham',
			'joseph-eschbach',
			'torsten-wambold',
			'a1abdoc',
			'jeffrey-morgan',
			'fabregerson',
			'tomglynn',
			'drewski-nz',
			'sascha',
			'ckonecny',
			'rommelreno',
			'changster710',
			'clive-cartlidge',
			'ryangoldvine',
			'mcdaddyof2',
			'sunrunner',
			'rkiaer',
			'krmackin',
			'michael-on',
			'3motive',
			'matthew-schipper',
			'caleb-smidt',
			'muness',
			'markuspfandtgmxde',
			'kdelios',
			'wilfried-beaumes',
			'thomas-tollstedt',
			'skjeflissimo',
			'willnewbery',
			'fondph',
			'pierpaolomaimone',
			'dan-hunter',
			'maeximus',
			'mzielinski',
			'der-pate',
			'john-wadelin',
			'lexelfr',
			'jan-mickos',
			'hesy',
			'crimez',
			'justin-kline',
			'birkeby',
			'nall',
			'runnerbean',
			'tschalpa',
			'tomhudd',
			'brentkeel',
			'kurthian',
			'erich-grohse-holz',
			'kdemarc1',
			'hrh',
			'miguel-angel-marquez',
			'caashford',
			'afeitkne',
			'chvofa',
			'rini-lol',
			'antoniomnp',
			'henrik-damslund',
			'tony5',
			'tstafford',
			'mojozoom',
			'teijevp',
			'oldplodder',
			'dennis-alvarez',
			'cpcervelo',
			'sander-van-der-meer',
			'patrocle',
			'erichunley',
			'jcharyk',
			'andré-lu',
			'briguy'
		];
		this.hasFeatures = false;
		this.addFeatures();
	}
	addFeatures() {
		if ('data' in user && 'user_name' in user.data) {
			if (this.usernames.indexOf(user.data.user_name.toLowerCase()) !== -1) {
				this.hasFeatures = true;
				// var dataReveal = document.querySelector('[data-reveal]');
				// dataReveal.classList.remove('hidden');
				// document.querySelector('header-element').enable('profile');
				// dataReveal.appendChild(
				// 	document.querySelector('#uploader')
				// );
			}
		}
	}
}

var featureManagement = new FeatureManagement();