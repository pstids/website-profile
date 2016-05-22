/**
 * Created by cnbuff410 on 5/18/16.
 */
(function(document) {
    'use strict';

    let selectWeek = 0;
    let selectDay = 0;

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
        // imports are loaded and elements have been registered
        app.planLevel = 'intermediate';
        app.planDistanceSelected = '5k';
        app.weekViewCnt = 0;
        app.weekNum = 4;
        app.updateWeekView(4, app.weekViewCnt);
    });

    document.addEventListener('card-tap', function (e) {
        selectWeek = e.detail.week - 1;
        selectDay = e.detail.day;

        let dialog = document.querySelector('#dialog');
        let info = e.detail.info;
        dialog.set(info, e.detail.week, e.detail.day);  // Displayed week
        dialog.open();
    });

    document.addEventListener('training-input', function (e) {
        let info = e.detail;
        if (Object.keys(info).length === 0) {
            return;
        }
        let weekViewContainer = Polymer.dom(document).querySelector('#weekviews');
        weekViewContainer.children[selectWeek].setCardData(selectDay, info);

        app.saveAll();
    });

    // Scroll page to top and expand header
    app.saveAll = function() {
        let weekViewContainer = Polymer.dom(document).querySelector('#weekviews');
        let workouts = [];
        for (let i = 0; i < weekViewContainer.children.length; i++) {
            let node = weekViewContainer.children[i];
            if (node.nodeName === 'TEMPLATE') {
                continue;
            }
            workouts = workouts.concat(node.data());
        }
        let days = [];
        for (var w of workouts) {
            days.push(w.day);
        }
        let plan = {
            name: app.planTitle,
            week_duration: parseInt(app.weekNum),
            level: app.planLevel,
            workouts: workouts,
            distance_type: app.planDistanceSelected,
            days: days
        };
        console.log('save all workouts', plan);
        superagent
            .post('/b/api/v1/training/plan')
            .send(plan)
            .set('Accept', 'application/json')
            .set('Authorization', 'Bearer: ' + jwt.token)
            .end(function(err, res) {
                if (res.ok) {
                    this.$.toast.text = 'Your training plan is uploaded!';
                } else {
                    this.$.toast.text = 'Your information has not been updated. Please try again.';
                }
                Polymer.dom(document).querySelector('#toast').show();
            }.bind(this));
    };

    app.onWeekInput = function() {
        app.updateWeekView(app.weekNum, app.weekViewCnt);
    };

    app.updateWeekView = function (num, cnt) {
        num = parseInt(num);
        cnt = parseInt(cnt);
        let weekViewContainer = Polymer.dom(document).querySelector('#weekviews');
        if (num > cnt) {
            let gap = num - app.weekViewCnt;
            let views = [];
            let i = 0;
            for (i = 0; i < gap; i++) {
                let weekView = document.createElement('plan-weekview');
                weekView.weekNum = app.weekViewCnt + (i + 1);
                views.push(weekView);
            }
            let docFrag = document.createDocumentFragment();
            for(i = 0; i < views.length; i++) {
                docFrag.appendChild(views[i]);
            }
            weekViewContainer.appendChild(docFrag);
        } else {
            let gap = cnt - num;
            let allChildren = weekViewContainer.childNodes;
            for (let i = 0; i < gap; i++) {
                weekViewContainer.removeChild(allChildren[app.weekViewCnt-i-1]);
            }
        }
        app.weekViewCnt = num;
    };
})(document);
