/**
 * Created by cnbuff410 on 5/18/16.
 */
(function(document) {
    'use strict';

    page.base('/powercenter/plan');

    page('/', () => {
        console.log('here');
        if (jwt.hasToken) {
            app.route = 'home';
        } else {
            page.redirect('/welcome');
        }
    });

    page('/:planID', (data) => {
        app.route = 'new-plan';
        app.params = data.params;
    });


    // Grab a reference to our auto-binding template
    // and give it some initial binding values
    // Learn more about auto-binding templates at http://goo.gl/Dx1u2g
    let app = document.querySelector('#app');

    // Listen for template bound event to know when bindings
    // have resolved and content has been stamped to the page
    app.addEventListener('dom-change', function() {
        console.log('Our app is ready to rock!');
    });

    // See https://github.com/Polymer/polymer/issues/1381
    window.addEventListener('WebComponentsReady', function() {
        console.log('Web components ready');
    });
})(document);
