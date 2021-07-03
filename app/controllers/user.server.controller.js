const user = require('../models/user.server.model');
const helper = require('../models/helper.server.model');
const fs = require('fs');

//REGISTER AS A NEW USER ==============================================================================================

exports.userRegister = async function (req, res) {
    console.log('\nRequest to register...');
    try {
        const parameters = req.body;
        const valid = await helper.userInfoValidation(parameters);
        if (valid) {
                const result = await user.insertNewUser(parameters);
                res.status(201)
                    .send({userId: result.insertId});
        } else {
            res.status(400)
                .send(`Bad Request`);
        }

    } catch (err) {
        res.status(500)
            .send(`ERROR getting events ${err}`);
    }
}

//LOG IN AS AN EXISTING USER===========================================================================================

exports.userLogin = async function (req, res) {
    console.log('\nRequest to log in...');
    try {
        const parameters = req.body;
        const valid = await helper.userLoginValidation(parameters);
        if (valid) {
            const email = parameters.email;
            const password = parameters.password;
            const result = await user.logIn(email);
            if (result.length === 0) {
                res.status(400)
                    .send("Invalid email...");
            } else {
                const state = await helper.myCompare(password, result[0].password);
                if (state) {
                    const token = await helper.myHash(result[0].email);
                    await helper.updateToken(email, token);
                    res.status(200)
                        .send({userId: result[0].id, token: token});
                } else {
                    res.status(400)
                        .send(`Invalid password...`);
                }
            }
        } else {
            res.status(400)
                .send(`Bad Request`);
        }
    } catch (err) {
        res.status(500)
            .send(`ERROR getting events ${err}`);
    }
}

//LOG OUT THE CURRENTLY AUTHORISED USER================================================================================

exports.userLogout = async function (req, res) {
    console.log('\nRequest to log out...');
    const authToken = req.headers["x-authorization"];
    try {
        const result = await user.findUser(authToken);
        if (result.length === 0) {
            res.status(401)
                .send(`Unauthorized`);
        } else {
            const user_id = result[0].id;
            await helper.updateLogoutToken(user_id);
            res.status(200)
                .send(`Log out successfully`);
        }
    } catch (err) {
        res.status(500)
            .send(`ERROR getting events ${err}`);
    }
}

//RETRIEVE INFO ABOUT A USER===========================================================================================

exports.getUserInfo = async function (req, res) {
    console.log('\nRequest to get a user...');
    const authToken = req.headers["x-authorization"];
    const id = req.params.id;
    try {
        const [result] = await user.getUserById(id);
        if (!result) {
            res.status(404)
                .send(`Not Found`);
        } else {
            const authorized = result.auth_token === authToken;
            if (authorized) {
                res.status(200)
                    .send({firstName: result.first_name, lastName: result.last_name, email: result.email});
            } else {
                res.status(200)
                    .send({firstName: result.first_name, lastName: result.last_name});
            }
        }
    } catch (err) {
        res.status(500)
            .send(`ERROR getting events ${err}`);
    }
}

//CHANGE A USER'S DETAILS==============================================================================================

exports.modifyUser = async function (req, res) {
    console.log('\nRequest to get a user...');
    const authToken = req.headers["x-authorization"];
    const id = req.params.id;
    const parameters = req.body;
    try {
        const valid = await helper.checkInput(parameters);
        if (valid) {
            if (authToken) {
                const [result] = await user.getUserById(id);
                if (result) {
                    const authorized = result.auth_token === authToken;
                    if (authorized) {
                        if (parameters.currentPassword) {
                            const state = await helper.myCompare(parameters.currentPassword, result.password);
                            if (state) {
                                await user.updateUserPassword(parameters, id);
                                await user.updateUser(parameters, id);
                                res.status(200)
                                    .send(`Update successful`);
                            } else {
                                res.status(403)
                                    .send(`Forbidden`);
                            }
                        } else {
                            await user.updateUser(parameters, id);
                            res.status(200)
                                .send(`Update successful`);
                        }
                    } else {
                        res.status(403)
                            .send(`Forbidden`);
                    }
                } else {
                    res.status(404)
                        .send(`Not Found`);
                }
            } else {
                res.status(401)
                    .send(`Unauthorized`);
            }
        } else {
            res.status(400)
                .send(`Bad Request`);
        }
    } catch (err) {
        res.status(500)
            .send(`ERROR getting events ${err}`);
    }
}

//SET A USER'S PROFILE IMAGE===========================================================================================

exports.setImage = async function (req, res) {
    console.log(`\nRequest to set a user/'s profile image...`);
    const user_id = req.params.id;
    const authToken = req.headers["x-authorization"];
    const imageType = req.headers["content-type"].split("/")[1];
    const photo = req.body;
    try {
        if (imageType === 'png' || imageType === 'jpeg' || imageType === 'gif') {
            if (authToken) {
                const [row] = await user.getUserById(user_id);
                if (row) {
                    const [auser] = await user.findUser(authToken);
                    const authorized = row.id === auser.id;
                    if (authorized) {
                        const path = 'storage/images/';
                        const filename = `user_${user_id}.${imageType}`;
                        const filePath = `${path}${filename}`;
                        fs.writeFileSync(filePath, photo, 'binary', function (err) {
                            if (err) throw err;
                        });
                        if (row.image_filename !== null) {
                            await user.updateUserImage(filename, user_id);
                            res.status(200)
                                .send(`Update successfully`);
                        } else {
                            await user.updateUserImage(filename, user_id);
                            res.status(201)
                                .send(`Upload successfully`);
                        }
                    } else {
                        res.status(403)
                            .send(`Forbidden`);
                    }
                } else {
                    res.status(404)
                        .send(`Not Found`);
                }
            } else {
                res.status(401)
                    .send(`Unauthorized`);
            }
        } else {
            res.status(400)
                .send(`Bad Request`);
        }
    } catch (err) {
        res.status(500)
            .send(`ERROR getting events ${err}`);
    }
}

// RETRIEVE AN EVENT'S HERO IMAGE======================================================================================

exports.showImage = async function (req, res) {
    console.log(`\nRequest to retrieve an event/'s hero image...`);
    const user_id = req.params.id;
    try {
        const [row] = await user.getUserById(user_id);
        if (row.image_filename !== null) {
            const path = 'storage/images/';
            const photo = fs.readFileSync(path + row.image_filename, (err, data) => {
                if (err) throw err;
                return data;
            });
            const type = "image/" + row.image_filename.split(".")[1];
            res.contentType(type);
            res.status(200)
                .send(photo);
        } else {
            res.status(404)
                .send(`Not Found`);
        }
    } catch (err) {
        res.status(500)
            .send(`ERROR getting events ${err}`);
    }
}

//DELETE A USER'S PROFILE IMAGE========================================================================================

exports.deleteImage = async function (req, res) {
    console.log(`\nRequest to delete a user's profile image...`);
    const user_id = req.params.id;
    const authToken = req.headers["x-authorization"];
    try {
        if (authToken) {
            const [row] = await user.getUserById(user_id);
            if (row) {
                const [auser] = await user.findUser(authToken);
                const authorized = row.id === auser.id;
                if (authorized) {
                    await user.deleteUserImage(user_id);
                    res.status(200)
                        .send(`OK`);
                } else {
                    res.status(403)
                        .send(`Forbidden`);
                }
            } else {
                res.status(404)
                    .send(`Not Found`);
            }
        } else {
            res.status(401)
                .send(`Unauthorized`);
        }
    } catch (err) {
        res.status(500)
            .send(`ERROR getting events ${err}`);
    }
}

