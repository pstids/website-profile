/*jshint -W079 */
/*jshint unused: false*/

class JWT {
	constructor() {
		this.token = localStorage.getItem('token');
		this.data = {};
		this.checkToken();
	}

	checkToken() {
		if (!this.token) {
			location.pathname = '/signin';
		} else {
			this.parseData();
		}
	}

	setToken(token) {
		localStorage.setItem('token', token);
	}

	parseData() {
		var blocks = this.token.split('.');
		this.data = JSON.parse(atob(blocks[1].replace(/\s/g, '')));
		this.checkRenewal();
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

	logout() {
		localStorage.removeItem('token');
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
		if (!(path in user.data)) {
			user.data[path] = null;
		}
		return user.data[path];
	}

	checkStorage() {
		if (!this.storage) {
			this.fetchDetails(null);
		} else {
			this.parseData();
		}
	}

	updateData(data) {
		this.data = data;
		localStorage.setItem('user', JSON.stringify(data));
	}

	clearData() {
		localStorage.removeItem('user');
	}

	parseData() {
		this.data = JSON.parse(this.storage);
	}

	fetchDetails(callback) {
        var that = this;
		superagent
			.get('/b/api/v1/users/' + jwt.data.id)
			.send()
			.set('Accept', 'application/json')
			.set('Authorization', 'Bearer: ' + jwt.token)
			.end(function(err, res) {
				if (res.ok) {
					console.log(res.body);
					localStorage.setItem('user', JSON.stringify(res.body));
					that.constructor();
					if (callback) {
						callback();
					}
				} else {
					console.log('Error: Setting user information');
				}
			});
	}
}

var user = new User();