const db = require('../../config/db');
const helper = require('../models/helper.server.model');
const fs = require('fs');

// VIEW EVENTS=========================================================================================================
exports.getEveWithParam = async function (parameter) {
    console.log('Request to get events which meet the conditions from the database...');
    const conn = await db.getPool().getConnection();
    let sql = await helper.mysqlGetEvent(parameter);
    if (!sql.includes("order")) {
        sql = sql + ` order by date DESC`;
    }
    let [rows] = await conn.query(sql, null);
    conn.release();
    rows = await helper.getCategories(rows);
    rows = await helper.myFilter(rows, parameter);
    return rows;
}


exports.reArrange = async function (arr) {
    let ans = [];

    for (const item of arr) {
        const [result] = await countAttendees(item.eventId);
        ans.push({
            eventId: item.eventId,
            title: item.title,
            categories: item.categories,
            organizerFirstName: item.organizerFirstName,
            organizerLastName: item.organizerLastName,
            numAcceptedAttendees: result.numAcceptedAttendees,
            capacity: item.capacity,
        });
    }
    return ans;
}


// ADD A NEW EVENT ====================================================================================================
exports.insertEvent = async function (parameters, user_id) {
    console.log('Request to insert a new event to the database...');
    const conn = await db.getPool().getConnection();

    const sql1 = `insert into event (title, description, date, image_filename, is_online, url, venue, capacity,
                                     requires_attendance_control, fee, organizer_id)
                  values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
    const values = await helper.initValues(parameters, user_id);
    const [rows] = await conn.query(sql1, values);

    const sql2 = `insert into event_category (event_id, category_id)
                  values (?, ?)`;
    for (const category_id of parameters.categoryIds) {
        await conn.query(sql2, [rows.insertId, category_id]);
    }
    conn.release();
    return rows;
}


// RETRIEVE DETAILED INFORMATION ABOUT AN EVENT========================================================================

exports.getEventById = async function (id) {
    console.log('Request to retrieve detailed information about an event from the database...');
    const conn = await db.getPool().getConnection();

    const sql = `select event.id                          as eventId,
                        event.title                       as title,
                        ec.category_id                    as categories,
                        user.first_name                   as organizerFirstName,
                        user.last_name                    as organizerLastName,
                        event.capacity                    as capacity,
                        event.description                 as description,
                        event.organizer_id                as organizerId,
                        event.date                        as date,
                        event.is_online                   as isOnline,
                        event.url                         as url,
                        event.venue                       as venue,
                        event.requires_attendance_control as requiresAttendanceControl,
                        event.fee                         as fee
                 from event
                          join user
                               on event.organizer_id = user.id
                          join event_category ec on event.id = ec.event_id
                 where event.id = (?)
                 group by event.id, event.date
                 order by event.date DESC`;


    let [rows] = await conn.query(sql, id);
    conn.release();
    rows = await helper.getCategories(rows);
    rows = await helper.getTrueFalse(rows);
    return rows;
}


async function countAttendees(id) {
    const conn = await db.getPool().getConnection();
    const sql = `select count(*) as numAcceptedAttendees
                 from event_attendees
                 where event_id = ?
                   and attendance_status_id = 1`;
    const [rows] = await conn.query(sql, id);
    conn.release();
    return rows;
}

module.exports.countAttendees = countAttendees;

// RETRIEVE ALL DATA ABOUT EVENT CATEGORIES============================================================================
exports.getEventCategory = async function () {
    console.log('Request to retrieve all data about event categories from the database...');
    const conn = await db.getPool().getConnection();
    const sql = `select id as categoryId, name
                 from category`;
    const [rows] = await conn.query(sql, null);
    conn.release();
    return rows;
}


// CHANGE AN EVENT'S DETAILS===========================================================================================
exports.findAnEvent = async function (id) {
    console.log('Request to find an event from the database...');
    const conn = await db.getPool().getConnection();
    const sql = `select *
                 from event
                 where id = ?`;
    const [rows] = await conn.query(sql, id);
    conn.release();
    return rows;
}


exports.changeEventDetails = async function (parameters, event_id) {
    console.log('Ready to update an event...');
    const conn = await db.getPool().getConnection();
    if (parameters.categoryIds) {
        await updateCategoryTable(event_id, parameters.categoryIds);
    }

    if (parameters.title) {
        const sql1 = `update event set title = ? where id = ?`;
        await conn.query(sql1, [parameters.title, event_id]);
    }

    if (parameters.description) {
        const sql2 = `update event set description = ? where id = ?`;
        await conn.query(sql2, [parameters.description, event_id]);
    }

    if (parameters.date) {
        const sql3 = `update event set date = ? where id = ?`;
        await conn.query(sql3, [parameters.date, event_id]);
    }

    if (parameters.isOnline) {
        const sql4 = `update event set is_online = ? where id = ?`;
        await conn.query(sql4, [parameters.isOnline, event_id]);
    }

    if (parameters.url) {
        const sql5 = `update event set url = ? where id = ?`;
        await conn.query(sql5, [parameters.url, event_id]);
    }

    if (parameters.venue) {
        const sql6 = `update event set venue = ? where id = ?`;
        await conn.query(sql6, [parameters.venue, event_id]);
    }

    if (parameters.capacity) {
        const sql7 = `update event set capacity = ? where id = ?`;
        await conn.query(sql7, [parameters.capacity, event_id]);
    }
    if (parameters.requiresAttendanceControl) {
        const sql8 = `update event set requires_attendance_control = ? where id = ?`;
        await conn.query(sql8, [parameters.requiresAttendanceControl, event_id]);
    }
    if (parameters.fee) {
        const sql9 = `update event set fee = ? where id = ?`;
        await conn.query(sql9, [parameters.fee, event_id]);
    }

    conn.release();
}


async function updateCategoryTable(event_id, arr) {
    const conn = await db.getPool().getConnection();

    //first delete all the old entry
    const sql1 = `delete
                  from event_category
                  where event_id = ?`;
    await conn.query(sql1, event_id);

    //insert event with new category id
    const sql2 = `insert into event_category (event_id, category_id)
                  values (?, ?)`;
    for (const category_id of arr) {
        await conn.query(sql2, [event_id, category_id]);
    }

    conn.release();
}


//DELETE AN EVENT======================================================================================================

exports.removeEvent = async function (id) {
    console.log('Request to delete an event from the database...');
    const conn = await db.getPool().getConnection();
    const sql1 = `delete
                  from event_category
                  where event_id = ?`;
    await conn.query(sql1, id);
    const sql2 = `delete
                  from event_attendees
                  where event_id = ?`;
    await conn.query(sql2, id);
    const sql3 = `delete
                  from event
                  where id = ?`;
    await conn.query(sql3, id);
    conn.release();
}

//SET AN EVENT'S HERO IMAGE============================================================================================

exports.updateEventImage = async function (filename, id) {
    console.log(`Request to update the hero image file name in the database...`);
    const conn = await db.getPool().getConnection();
    const sql = `update event
                 set image_filename = ?
                 where id = ?`;
    await conn.query(sql, [filename, id]);
    conn.release();
}

//RETRIEVE AN EVENT'S ATTENDEES========================================================================================


exports.selectAttendees = async function (event_id) {
    console.log("Retrieve an event's attendees from the database...");
    const conn = await db.getPool().getConnection();

    const sql = `select user.id             as attendeeId,
                        ast.name            as status,
                        user.first_name     as firstName,
                        user.last_name      as lastName,
                        ea.date_of_interest as dateOfInterest
                 from event_attendees ea
                          join user on user.id = ea.user_id
                          join attendance_status ast on ea.attendance_status_id = ast.id
                 where ea.event_id = ?
                 order by dateOfInterest`;

    const [row] = await conn.query(sql, event_id);
    conn.release();
    return row;
}


exports.findCurrentStatus = async function (user_id) {
    const conn = await db.getPool().getConnection();
    const sql = `select *
                 from event_attendees
                 where user_id = ?`;

    const [row] = await conn.query(sql, user_id);
    conn.release();
    return row;
}


// REQUEST ATTENDANCE TO AN EVENT======================================================================================
exports.checkAttendance = async function (event_id, user_id) {
    const conn = await db.getPool().getConnection();
    const sql = `select *
                 from event_attendees
                 where event_id = (?)
                   and user_id = (?)`;

    const [row] = await conn.query(sql, [event_id, user_id]);
    conn.release();
    return row;
}

exports.joinEvent = async function (event_id, user_id) {
    const conn = await db.getPool().getConnection();
    const sql = `insert into event_attendees (event_id, user_id, attendance_status_id)
                 values (?, ?, 2)`;
    await conn.query(sql, [event_id, user_id]);
    conn.release();
}

//REMOVE AN ATTENDEE FROM AN EVENT=====================================================================================

exports.removeAttendees = async function (event_id, user_id) {
    const conn = await db.getPool().getConnection();
    const sql = `delete
                 from event_attendees
                 where event_id = ?
                   and user_id = ?`;

    await conn.query(sql, [event_id, user_id]);
    conn.release();
}


//CHANGE THE STATUS OF AN ATTENDEE OF AN EVENT=========================================================================
exports.changeStatus = async function (event_id, user_id, status_id) {
    const conn = await db.getPool().getConnection();
    const sql = `update event_attendees
                 set attendance_status_id = ?
                 where event_id = ?
                   and user_id = ?`;

    await conn.query(sql, [status_id, event_id, user_id]);
    conn.release();
}

