/**
 * Created by cnbuff410 on 5/18/16.
 */
(function(document) {
    'use strict';

    let app = document.querySelector('#app');
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

    // Listen for template bound event to know when bindings
    // have resolved and content has been stamped to the page
    app.addEventListener('dom-change', () => {
        console.log('Our app is ready to rock!');
    });
    // See https://github.com/Polymer/polymer/issues/1381
    window.addEventListener('WebComponentsReady', () => {
        console.log('Web components ready');
    });
})(document);
