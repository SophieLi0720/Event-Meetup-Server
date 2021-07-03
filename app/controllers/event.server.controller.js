const event = require('../models/event.server.model');
const helper = require('../models/helper.server.model');
const user = require('../models/user.server.model');
const fs = require('fs');

// VIEW EVENTS=========================================================================================================

exports.listEvents = async function (req, res) {
    console.log('\nRequest to list events...');
    const parameters = req.query;
    try {
        const valid = await helper.inputValidation(parameters);
        if (valid) {
            const result = await event.getEveWithParam(parameters);
            const ans = await event.reArrange(result);
            res.status(200)
                .send(ans);
        } else {
            res.status(400)
                .send(`Bad Request`);
        }
    } catch (err) {
        res.status(500)
            .send(`ERROR getting events ${err}`);
    }
}


// ADD A NEW EVENT ====================================================================================================

exports.addEvent = async function (req, res) {
    console.log('\nRequest to add events...');
    const parameters = req.body;
    const authToken = req.headers["x-authorization"];
    try {
        const valid = await helper.checkEvent(parameters);
        if (valid) {
            if (authToken) {
                const result = await user.findUser(authToken);
                if (result.length === 0) {
                    res.status(401)
                        .send(`Unauthorized`);
                } else {
                    const user_id = result[0].id;
                    const ans = await event.insertEvent(parameters, user_id);
                    res.status(201)
                        .send({eventId: ans.insertId});
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


// RETRIEVE DETAILED INFORMATION ABOUT AN EVENT========================================================================

exports.listEventsDetail = async function (req, res) {
    console.log('\nRequest to list events details...');
    const id = req.params.id;
    try {
        const [result] = await event.getEventById(id);
        const [ans] = await event.countAttendees(id);
        if (result) {
            res.status(200)
                .send({
                    eventId: result.eventId,
                    title: result.title,
                    categories: result.categories,
                    organizerFirstName: result.organizerFirstName,
                    organizerLastName: result.organizerLastName,
                    numAcceptedAttendees: ans.numAcceptedAttendees,
                    capacity: result.capacity,
                    description: result.description,
                    organizerId: result.organizerId,
                    date: result.date,
                    isOnline: !!result.isOnline,
                    url: result.url,
                    venue: result.venue,
                    requiresAttendanceControl: result.requiresAttendanceControl,
                    fee: parseFloat(result.fee)
                });
        } else {
            res.status(404)
                .send(`Not Found`);
        }
    } catch (err) {
        res.status(500)
            .send(`ERROR getting events ${err}`);
    }
}


// RETRIEVE ALL DATA ABOUT EVENT CATEGORIES============================================================================

exports.listEventCategory = async function (req, res) {
    console.log('\nRequest to list event categories details...');
    try {
        const result = await event.getEventCategory();
        res.status(200)
            .send(result);
    } catch (err) {
        res.status(500)
            .send(`ERROR getting events ${err}`);
    }
}

// CHANGE AN EVENT'S DETAILS===========================================================================================

exports.updateEvents = async function (req, res) {
    console.log(`\nRequest to change an event's details...`);
    const id = req.params.id;
    const authToken = req.headers["x-authorization"];
    const parameters = req.body;
    try {
        const [row] = await event.findAnEvent(id);
        if (row) {
            if (authToken) {
                const organizerId = row.organizer_id;
                const match = await helper.checkAuthentication(organizerId, authToken);
                if (match) {
                    const not_happened = await helper.isInTheFuture(row.date);
                    const valid = await helper.changeEventDetailsRequest(parameters);
                    if (valid && not_happened) {
                        await event.changeEventDetails(parameters, id);
                        res.status(200)
                            .send(`Update successfully`);
                    } else {
                        res.status(400)
                            .send(`Bad Request`);
                    }
                } else {
                    res.status(403)
                        .send(`Forbidden`);
                }
            } else {
                res.status(401)
                    .send(`Unauthorized`);
            }
        } else {
            res.status(404)
                .send(`Not Found`);
        }
    } catch (err) {
        res.status(500)
            .send(`ERROR getting events ${err}`);
    }
}

//DELETE AN EVENT======================================================================================================

exports.deleteEvent = async function (req, res) {
    console.log(`\nRequest to delete an event...`);
    const id = req.params.id;
    const authToken = req.headers["x-authorization"];
    try {
        if (authToken) {
            const [row] = await event.findAnEvent(id);
            if (row) {
                const [auser] = await user.findUser(authToken);
                const authorized = row.organizer_id === auser.id;
                if (authorized) {
                    await event.removeEvent(id);
                    res.status(200)
                        .send(`Delete successfully`);
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

//SET AN EVENT'S HERO IMAGE============================================================================================

exports.putImage = async function (req, res) {
    console.log(`\nRequest to set an event/'s hero image...`);
    const event_id = req.params.id;
    const authToken = req.headers["x-authorization"];
    const imageType = req.headers["content-type"].split("/")[1];
    const photo = req.body;
    try {
        if (imageType === 'png' || imageType === 'jpeg' || imageType === 'gif') {
            if (authToken) {
                const [row] = await event.findAnEvent(event_id);
                if (row) {
                    const [auser] = await user.findUser(authToken);
                    const authorized = row.organizer_id === auser.id;
                    if (authorized) {
                        const path = 'storage/images/';
                        const filename = `event_${event_id}.${imageType}`;
                        const filePath = `${path}${filename}`;
                        fs.writeFileSync(filePath, photo, 'binary', function (err) {
                            if (err) throw err;
                        });
                        if (row.image_filename !== null) {
                            await event.updateEventImage(filename, event_id);
                            res.status(200)
                                .send(`Update successfully`);
                        } else {
                            await event.updateEventImage(filename, event_id);
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

exports.getImage = async function (req, res) {
    console.log(`\nRequest to retrieve an event/'s hero image...`);
    const event_id = req.params.id;
    try {
        const [row] = await event.findAnEvent(event_id);
        if (row) {
            if (row.image_filename !== null) {
                const path = 'storage/images/';
                const photo = fs.readFileSync(path + row.image_filename, (err, data) => {
                    if (err) throw err;
                    return data;
                });
                let type = "image/" + row.image_filename.split(".")[1];
                if (row.image_filename.split(".")[1] === "jpg") {
                    type = "image/jpeg";
                }
                res.contentType(type);
                res.status(200)
                    .send(photo);
            } else {
                res.status(200)
                    .send(`No photo`);
            }
        } else {
            res.status(404)
                .send(`Not Found`);
        }

    } catch (err) {
        res.status(500)
            .send(`ERROR getting events ${err}`);
    }
}

//RETRIEVE AN EVENT'S ATTENDEES========================================================================================

exports.findAttendees = async function (req, res) {
    console.log("\nRequest to retrieve an event's attendees...");
    const event_id = req.params.id;
    const authToken = req.headers["x-authorization"];
    try {
        const [current_event] = await event.findAnEvent(event_id);
        if (current_event) {
            const attendees = await event.selectAttendees(event_id);
            if (authToken) {
                const [current_user] = await user.findUser(authToken);
                if (current_user.id === current_event.organizer_id) {
                    res.status(200)
                        .send(attendees);
                } else {
                    const [row] = await event.findCurrentStatus(parseInt(current_user.id));
                    if (row) {
                        const current_status = row.attendance_status_id;
                        if (current_status === 1) {
                            const result = await helper.findAccepted(attendees);
                            res.status(200)
                                .send(result);
                        } else {
                            const result = await helper.findAcceptedAndSelf(attendees, current_user.id);
                            res.status(200)
                                .send(result);
                        }
                    } else {
                        const result = await helper.findAccepted(attendees);
                        res.status(200)
                            .send(result);
                    }
                }
            } else {
                const result = await helper.findAccepted(attendees);
                res.status(200)
                    .send(result);
            }
        } else {
            res.status(404)
                .send(`Not Found`);
        }
    } catch (err) {
        res.status(500)
            .send(`ERROR getting events ${err}`);
    }
}

// REQUEST ATTENDANCE TO AN EVENT======================================================================================

exports.reqAttendance = async function (req, res) {
    console.log(`\nRequest attendance to an event...`);
    const event_id = req.params.id;
    const authToken = req.headers["x-authorization"];
    try {
        const [current_event] = await event.findAnEvent(event_id);
        if (current_event) {
            if (authToken) {
                const [current_user] = await user.findUser(authToken);
                const [attendance] = await event.checkAttendance(event_id, current_user.id);
                const not_happened = await helper.isInTheFuture(current_event.date);
                if (!attendance && not_happened) {
                    await event.joinEvent(event_id, current_user.id);
                    res.status(201)
                        .send(`Created`);
                } else {
                    res.status(403)
                        .send(`Forbidden`);
                }
            } else {
                res.status(401)
                    .send(`Unauthorized`);
            }
        } else {
            res.status(404)
                .send(`Not Found`);
        }

    } catch (err) {
        res.status(500)
            .send(`ERROR getting events ${err}`);
    }
}

//REMOVE AN ATTENDEE FROM AN EVENT=====================================================================================

exports.deleteAttendees = async function (req, res) {
    console.log(`\nRequest to remove an attendee from an event...`);
    const event_id = req.params.id;
    const authToken = req.headers["x-authorization"];
    try {
        const [current_event] = await event.findAnEvent(event_id);
        if (current_event) {
            if (authToken) {
                const [current_user] = await user.findUser(authToken);
                if (current_user) {
                    const [attendance] = await event.checkAttendance(event_id, current_user.id);
                    const not_happened = await helper.isInTheFuture(current_event.date);
                    if (attendance && (not_happened && attendance.attendance_status_id !== 3)) {
                        await event.removeAttendees(event_id, current_user.id);
                        res.status(200)
                            .send(`OK`);
                    } else {
                        res.status(403)
                            .send(`Forbidden`);
                    }
                } else {
                    res.status(401)
                        .send(`Unauthorized`);
                }
            } else {
                res.status(401)
                    .send(`Unauthorized`);
            }
        } else {
            res.status(404)
                .send(`Not Found`);
        }

    } catch (err) {
        res.status(500)
            .send(`ERROR getting events ${err}`);
    }
}

//CHANGE THE STATUS OF AN ATTENDEE OF AN EVENT=========================================================================

exports.updateAttendees = async function (req, res) {
    console.log(`\nRequest to change the status of an attendee of an event...`);
    const event_id = req.params.event_id;
    const user_id = req.params.user_id;
    const authToken = req.headers["x-authorization"];
    const status = req.body.status;
    try {
        const inputValid = await helper.validStatus(status);
        if (inputValid) {
            const status_id = await helper.findStatusId(status);
            const [current_event] = await event.findAnEvent(event_id);
            if (current_event) {
                if (authToken) {
                    const [current_user] = await user.findUser(authToken);
                    if (current_user && current_user.id === current_event.organizer_id) {
                        await event.changeStatus(event_id, user_id, status_id);
                        res.status(200)
                            .send(`OK`);
                    } else {
                        res.status(403)
                            .send(`Forbidden`);
                    }
                } else {
                    res.status(401)
                        .send(`Unauthorized`);
                }
            } else {
                res.status(404)
                    .send(`Not Found`);
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

