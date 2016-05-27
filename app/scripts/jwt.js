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
			// location.pathname = '/signin';
			this.token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJlbWFpbCI6Imd1ZXN0QHN0cnlkLmNvbSIsImV4cCI6NDYwNDk2MjEwMTk1NiwiZmlyc3RuYW1lIjoiU3RyeWQiLCJpZCI6Ii0xIiwiaW1hZ2UiOiIiLCJsYXN0bmFtZSI6IlJ1bm5lciIsInVzZXJuYW1lIjoiZ3Vlc3QifQ.jlm3nYOYP_L9r8vpOB0SOGnj5t9i8FWwpn5UxOfar1M';
			console.log('No token present!');
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
		if ('exp' in this.data) {
			if (this.data.exp < Date.now()) {
				this.requestToken();
			}
		} else {
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
				.end(function(err, res) {
					if (res.ok) {
						localStorage.setItem('token', res.body.token);
						this.constructor();
					} else {
						this.logout();
					}
				}.bind(this));
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
		if (!(path in this.data) || this.data.path === null) {
			this.data[path] = null;
			this.fetchDetails(true);
		}
		return this.data[path];
	}

	getImage() {
		this.defaultURL = 'https://www.stryd.com/powercenter/images/favicon.png';
		if ('profile_medium' in this.data && this.data.profile_medium !== '') {
			return this.data.profile_medium;
			// return decodeURIComponent(this.data.profile_medium.replace('+', ' '));
		} else if ('email' in this.data && this.data.email !== '') {
			var gravHash = CryptoJS.MD5(this.data.email.toLowerCase());
			return 'http://www.gravatar.com/avatar/' + gravHash + '?d=' + this.defaultURL;
		} else {
			return 'https://www.stryd.com/powercenter/images/favicon.png';
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
			.end(function(err, res) {
				if (res.ok) {
					console.log(res.body);
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
		superagent
			.get('http://www.mocky.io/v2/57355f7b130000981ccde03c')
			.set('Accept', 'application/json')
			.end((err, res) => {
				if (res.ok && res.body !== null) {
					console.log('received plan', res.body);
					this.plan = res.body;
					this.processPlan();
				} else {
					console.log('Error: failure to get training plan', err);
				}
			});
	}

	processPlan() {
		for (var i = 0; i < this.plan.workouts.length; i++) {
			var additionalDays = this.plan.days[i];
			var targetDate = moment(this.plan.start_date)
				.add(additionalDays, 'days');
			var dateHash = targetDate.format('YYYYMMDD');
			this.days[dateHash] = this.plan.workouts[i];
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
