/*global superagent */
/*jshint unused: false*/

class JWT {
	constructor() {
		this.token = localStorage.getItem('token');
		this.data = {};
		this.checkToken();
	}

	checkToken() {
		if (this.token === null) {
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
		this.data = JSON.parse(atob(blocks[1]));
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

	logout() {
		localStorage.removeItem('token');
		location.pathname = '/signin';
	}
}

var jwt = new JWT();