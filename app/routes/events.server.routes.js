const events = require('../controllers/event.server.controller');

module.exports = function (app) {
    app.route(app.rootUrl + '/events')
        .get(events.listEvents)
        .post(events.addEvent);

    app.route(app.rootUrl + '/events/categories')
        .get(events.listEventCategory);

    app.route(app.rootUrl + '/events/:id')
        .get(events.listEventsDetail)
        .patch(events.updateEvents)
        .delete(events.deleteEvent);

    app.route(app.rootUrl + '/events/:id/image')
        .put(events.putImage)
        .get(events.getImage);

    app.route(app.rootUrl + '/events/:id/attendees')
        .get(events.findAttendees)
        .post(events.reqAttendance)
        .delete(events.deleteAttendees);

    app.route(app.rootUrl + '/events/:event_id/attendees/:user_id')
        .patch(events.updateAttendees);
}