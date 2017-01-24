/*jshint -W079 */
/*jshint unused: false*/
/*global CryptoJS*/
/*global processor*/

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
		if (window.location.hostname !== 'stryd.dev') {
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

		if (window.location.hostname === 'stryd.dev') {
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
			this.days[dateHash] = workout;
		}
		processor.postMessage({
			type: 'setPlan',
			trainingPlan: this.plan,
			trainingDays: this.days
		});
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
	}
	setURL(activityID, trainingID) {
		this.activityID = activityID;
		this.trainingID = trainingID;
		if (this.activityID !== 0) {
			page(`/run/${this.activityID}`);
		} else if (this.compareID !== 0) {
			page(`/training/${this.compareID}`);
		}
	}
	compareRun(compareID) {
		if (compareID !== null) {
			this.compareID = compareID;
		}
		if (this.activityID !== 0 && this.compareID !== 0) {
			page(`/run/${this.activityID}/run/${this.compareID}`);
		} else {
			page(`/run/${this.activityID}`);
		}
	}
	view(select) {
		if (select === 'analysis') {
			page(`/run/${this.activityID}`);
		} else if (select === 'comparison') {
			page(`/run/${this.activityID}/run/${this.compareID}`);
		} else if (select === 'training') {
			page(`/run/${this.activityID}/training/${this.trainingID}`);
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
        var srtDate = this.dateSpan.start.format('MM-DD-YYYY');
        var endDate = this.dateSpan.end.format('MM-DD-YYYY');
        var activityEndPoint = `/b/api/v1/activities/calendar?srtDate=${srtDate}&endDate=${endDate}&sortBy=StartDate`;
        // if (this.mode === 'admin') {
        //     activityEndPoint = `/b/admin/users/${this.user}/activities/calendar?srtDate=${srtDate}&endDate=${endDate}&sortBy=StartDate`;
        // }
        superagent
            .get(activityEndPoint)
            .send()
            .set('Accept', 'application/json')
            .set('Authorization', `Bearer: ${jwt.token}`)
            .end((err, res) => {
                if (res.ok) {
                    if (res.body !== null && res.body.activities !== null) {
                        this.saveActivities(res.body.activities);
                        this.loadLast(res.body.last_activity);
                    } else {
                        this.saveActivities([]);
                        this.loadLast(res.body.last_activity);
                    }
                } else {
                    console.log('Error: failure on grabLogs', err, res);
                }
            });
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
        // if (this.mode === 'admin') {
        //     activityEndPoint = `/b/admin/users/${this.user}/activities/calendar?srtDate=${srtDate}&endDate=${endDate}&sortBy=StartDate`;
        // }
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
    loadLast(id) {
        page(`/powercenter/run/${id}`);
        this.hasLoaded = true;
        // var bubbles = document.querySelector('.bubbles');
        // var workout = document.querySelector('workout-element');
        // workout.setLoading();
        // page(`/run/${id}`);
        // window.scrollTo(0, bubbles.offsetTop);
        // this.hasLoaded = true;
    }
}

var calendarManager = new CalendarManager();