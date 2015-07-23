/*global superagent */
/*global jwt */
/*jshint unused: false*/

var attyHelper = function(selector) {
  var eles = document.querySelectorAll('[data-' + selector + ']');
  var holder = {};
  for (var i = 0; i < eles.length; i++) {
    holder[eles[i].dataset[selector]] = eles[i];
  }
  return holder;
};

class ServiceAuthenticator {
	constructor() {
		this.update();
	}

	update() {
		superagent
			.get('/b/v1/users/' + jwt.data.id + '/platforms')
			.send()
			.set('Accept', 'application/json')
			.set('Authorization', 'Bearer: ' + jwt.token)
			.end((err, res) => {
				if (res.ok) {
					this.updateView(res.body);
				} else {

				}
			});
	}

	updateView(platforms) {
		var platform;
		var platformContainers = attyHelper('platform');
		console.log(platformContainers);
		for (var i = 0; i < platforms.length; i++) {
			platform = platforms[i];

			if (!platform.status) {
				platformContainers[platform.platform].dataset.toggle = 'off';
			} 
		}
	}
}

var sa = new ServiceAuthenticator();