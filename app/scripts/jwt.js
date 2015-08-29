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
		this.data = {};
		this.checkStorage();
	}

	checkStorage() {
		if (!this.storage) {
			this.fetchDetails();
		} else {
			this.parseData();
		}
	}

	parseData() {
		this.data = JSON.parse(this.storage);
		console.log(this.data, 'from user');
	}

	fetchDetails() {
		superagent
			.get('/b/api/v1/users/' + jwt.data.id)
			.send()
			.set('Accept', 'application/json')
			.set('Authorization', 'Bearer: ' + jwt.token)
			.end(function(err, res) {
				if (res.ok) {
					localStorage.setItem('user', JSON.stringify(res.body));
					this.constructor();
				} else {
					console.log('Error: Setting user information');
				}
			}.bind(this));
	}
}

var user = new User();