const users = require('../controllers/user.server.controller');

module.exports = function (app) {

    app.route(app.rootUrl + '/users/register')
        .post(users.userRegister)


    app.route(app.rootUrl + '/users/login')
        .post(users.userLogin);


    app.route(app.rootUrl + '/users/logout')
        .post(users.userLogout);

    app.route(app.rootUrl + '/users/:id')
        .get(users.getUserInfo)
        .patch(users.modifyUser);

    app.route(app.rootUrl + '/users/:id/image')
        .put(users.setImage)
        .get(users.showImage)
        .delete(users.deleteImage);

}