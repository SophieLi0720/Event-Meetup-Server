//Helper functions=====================================================================================================
const db = require('../../config/db');
const bcrypt = require('bcrypt');


// EVENTS==============================================================================================================
exports.inputValidation = async function (parameter) {
    let valid = true;
    const available_values = ["ALPHABETICAL_ASC", "ALPHABETICAL_DESC", "ATTENDEES_ASC", "ATTENDEES_DESC", "DATE_ASC", "DATE_DESC", "CAPACITY_ASC", "CAPACITY_DESC"];

    if (parameter.startIndex && !isInt(parameter.startIndex)) {
        valid = false;
    }

    if (parameter.count && !isInt(parameter.count)) {
        valid = false;
    }

    if (parameter.categoryIds) {

        if (typeof parameter.categoryIds === 'string' && !isInt(parameter.categoryIds)) {
            valid = false;
        }
        if (typeof parameter.categoryIds === 'string' && isInt(parameter.categoryIds)) {
            if (parseInt(parameter.categoryIds) < 1 || parseInt(parameter.categoryIds) > 24) {
                valid = false;
            }
        }

        if (typeof parameter.categoryIds === 'object') {
            for (const item of parameter.categoryIds) {
                if (!isInt(item)) {
                    valid = false;
                    break;
                } else {
                    if (parseInt(item) < 1 || parseInt(item) > 24) {
                        valid = false;
                    }
                }
            }
        }
    }

    if (parameter.organizerId && !isInt(parameter.organizerId)) {
        valid = false;
    }

    if (parameter.sortBy && !available_values.includes(parameter.sortBy)) {
        valid = false;
    }
    return valid;
}


const isInt = function (str) {
    return !isNaN(str) && Number.isInteger(parseFloat(str));
}


exports.mysqlGetEvent = async function (parameter) {
    let sql = `select event.id        as eventId,
                      event.title     as title,
                      ec.category_id  as categories,
                      user.first_name as organizerFirstName,
                      user.last_name  as organizerLastName,
                      event.capacity  as capacity
               from event
                        join user on event.organizer_id = user.id
                        join event_category ec on event.id = ec.event_id`;


    if (parameter.categoryIds) {

        let condition2 = ` `;
        let arr = parameter.categoryIds;

        for (const index in arr) {
            if (index === '0') {
                condition2 += ` (ec.category_id = ${arr[index]} `;
            } else {
                condition2 = condition2 + `or ec.category_id = ${arr[index]} `;
            }
        }
        condition2 += ')';

        if (sql.includes("where")) {
            sql = sql + ' and' + condition2;
        } else {
            sql = sql + ' where' + condition2;
        }

    }

    if (parameter.q) {
        const condition1 = ` (event.title like '%${parameter.q}%' or event.description like '%${parameter.q}%')`;

        if (sql.includes("where")) {
            sql = sql + ' and' + condition1;
        } else {
            sql = sql + ' where' + condition1;
        }
    }

    if (parameter.organizerId) {
        const condition3 = ` event.organizer_id = ${parameter.organizerId}`;

        if (sql.includes("where")) {
            sql = sql + ' and' + condition3;
        } else {
            sql = sql + ' where' + condition3;
        }
    }

    sql = sql + ' group by event.id, event.date';

    if (parameter.sortBy) {
        let condition4;
        if (parameter.sortBy === "ALPHABETICAL_ASC") {
            condition4 = ` order by event.title ASC`;
        }
        if (parameter.sortBy === "ALPHABETICAL_DESC") {
            condition4 = ` order by event.title DESC`;
        }
        if (parameter.sortBy === "DATE_ASC") {
            condition4 = ` order by event.date ASC`;
        }
        if (parameter.sortBy === "DATE_DESC") {
            condition4 = ` order by event.date DESC`;
        }
        if (parameter.sortBy === "ATTENDEES_ASC") {
            condition4 = ` order by event.requires_attendance_control ASC`;
        }
        if (parameter.sortBy === "ATTENDEES_DESC") {
            condition4 = ` order by event.requires_attendance_control DESC`;
        }
        if (parameter.sortBy === "CAPACITY_ASC") {
            condition4 = ` order by event.capacity ASC`;
        }
        if (parameter.sortBy === "CAPACITY_DESC") {
            condition4 = ` order by event.capacity DESC`;
        }

        sql = sql + condition4;
    }

    return sql;
}


exports.getCategories = async function (rows) {
    const conn = await db.getPool().getConnection();
    for (const row of rows) {
        let arr = [];
        let [categories] = await conn.query(`select category_id
                                             from event_category
                                             where event_id = (?)`, row.eventId);
        for (const item of categories) {
            arr.push(item.category_id);
        }
        row.categories = arr;
    }
    conn.release();
    return rows;
}


exports.getTrueFalse = async function (rows) {
    for (const row of rows) {
        row.isOnline = row.isOnline === 1;
        row.requiresAttendanceControl = row.requiresAttendanceControl === 1;
    }
    return rows;
}


exports.myFilter = async function (rows, parameter) {
    if (parameter.startIndex) {
        rows = rows.filter((item, index) => index >= parameter.startIndex);
    }
    if (parameter.count) {
        rows = rows.filter((item, index) => index < parameter.count);
    }
    return rows;
}


exports.checkEvent = async function (parameters) {
    let valid = true;

    if (!parameters.title) {
        valid = false;
    } else {
        if (parameters.title.length < 1) {
            valid = false;
        }
    }

    if (!parameters.description) {
        valid = false;
    }

    if (!parameters.categoryIds) {
        valid = false;
    } else {
        if (!await isValidCategoryId(parameters.categoryIds)) {
            valid = false;
        }

    }

    if (!parameters.date) {
        valid = false;
    } else {
        if (!await isValidDate(parameters.date)) {
            valid = false;
        }
    }

    if (parameters.isOnline && !(typeof parameters.isOnline === 'boolean')) {
        valid = false;
    }

    if (parameters.capacity) {
        if (!isInt(parameters.capacity)) {
            valid = false;
        } else {
            if (parameters.capacity < 0) {
                valid = false;
            }
        }

    }

    if (parameters.requiresAttendanceControl && !(typeof parameters.requiresAttendanceControl === 'boolean')) {
        valid = false;
    }
    if (parameters.fee) {
        if (isNaN(parameters.fee)) {
            valid = false;
        } else {
            if (parameters.fee < 0) {
                valid = false;
            }
        }
    }

    return valid;
}


async function isValidDate(str) {
    const conn = await db.getPool().getConnection();
    let [[row]] = await conn.query(`select CAST(? as datetime) as date`, str);
    conn.release();
    const date = row.date;

    if (date === null) {
        return false;
    } else {
        let [ans] = await conn.query(`select (sysdate() < ?) as result`, date);
        conn.release();
        return ans[0].result;
    }

}

exports.initValues = async function (parameters, user_id) {

    const title = parameters.title;
    const description = parameters.description;
    const organizer_id = user_id;
    const image_filename = null;
    const date = parameters.date;

    let is_online = 0;
    let url = null;
    let venue = null;
    let capacity = null;
    let requires_attendance_control = 0;
    let fee = 0.00;

    if (parameters.isOnline) {
        is_online = parameters.isOnline;
    }
    if (parameters.url) {
        url = parameters.url;
    }
    if (parameters.venue) {
        venue = parameters.venue;
    }
    if (parameters.capacity) {
        capacity = parameters.capacity;
    }
    if (parameters.requiresAttendanceControl) {
        requires_attendance_control = parameters.requiresAttendanceControl;
    }
    if (parameters.fee) {
        fee = parameters.fee;
    }

    return [title, description, date, image_filename, is_online, url, venue, capacity, requires_attendance_control, fee, organizer_id];

}


exports.checkAuthentication = async function (organizer_id, auth_token) {
    console.log('Check authentication...');
    const conn = await db.getPool().getConnection();
    const sql = `select *
                 from user
                 where auth_token = ?`;
    const [row] = await conn.query(sql, auth_token);
    conn.release();
    return row[0].id === organizer_id;
}


exports.isInTheFuture = async function (date) {
    console.log('Check if this  event was already happened...');
    const conn = await db.getPool().getConnection();
    const [ans] = await conn.query(`select (sysdate() < ?) as result`, date);
    conn.release();
    return ans[0].result;
}


async function isValidCategoryId(arr) {
    let valid = true;
    console.log('Check if each category reference a existing category...');
    const conn = await db.getPool().getConnection();
    for (const category_num of arr) {
        let [row] = await conn.query(`select *
                                      from category
                                      where id = ?`, category_num);
        if (row.length < 1) {
            valid = false;
            break;
        }
    }
    conn.release();
    return valid;
}


exports.changeEventDetailsRequest = async function (parameters) {

    let valid = true;

    if (parameters.title.length < 1) {
        valid = false;
    }

    if (parameters.date) {
        if (!await isValidDate(parameters.date)) {
            valid = false;
        }
    }
    if (parameters.categoryIds) {
        if (!await isValidCategoryId(parameters.categoryIds)) {
            valid = false;
        }
    }
    if (parameters.isOnline && !(typeof parameters.isOnline === 'boolean')) {
        valid = false;
    }

    if (parameters.capacity) {
        if (!isInt(parameters.capacity)) {
            valid = false;
        } else {
            if (parameters.capacity < 0) {
                valid = false;
            }
        }

    }

    if (parameters.requiresAttendanceControl && !(typeof parameters.requiresAttendanceControl === 'boolean')) {
        valid = false;
    }

    if (parameters.fee) {
        if (isNaN(parameters.fee)) {
            valid = false;
        } else {
            if (parameters.fee < 0) {
                valid = false;
            }
        }
    }
    return valid;
}


// USERS===============================================================================================================

exports.userInfoValidation = async function (parameter) {
    let valid = true;

    if (!parameter.firstName) {
        valid = false;
    }

    if (!parameter.lastName) {
        valid = false;
    }

    if (!parameter.password) {
        valid = false;
    }

    if (!parameter.email) {
        valid = false;
    } else {
        valid = await checkEmail(parameter.email);
    }
    return valid;
}


const checkEmail = async function (email) {
    let valid = true;
    if (!email.includes("@")) {
        valid = false;
    }
    if (await isInUse(email)) {
        valid = false;
    }
    return valid;
}


const isInUse = async function (str) {
    console.log(`Checking email...`);
    const conn = await db.getPool().getConnection();
    let [rows] = await conn.query(`select *
                                   from user
                                   where email = ?`, str);
    conn.release();
    return rows.length !== 0;
}


exports.initUserValues = async function (parameter) {

    const first_name = parameter.firstName;
    const last_name = parameter.lastName;
    const email = parameter.email;
    const password = await myHash(parameter.password);

    return [email, first_name, last_name, password];
}


async function myHash(str) {
    const saltRounds = 5;
    return bcrypt.hash(str, saltRounds);
}

module.exports.myHash = myHash;


async function myCompare(plaintext, hash) {
    return bcrypt.compare(plaintext, hash);
}

module.exports.myCompare = myCompare;


exports.userLoginValidation = async function (parameter) {
    let valid = true;
    if (!parameter.email) {
        valid = false;
    }
    if (!parameter.password) {
        valid = false;
    }
    return valid;
}


exports.updateToken = async function (email, token) {
    const conn = await db.getPool().getConnection();
    const sql = `update user
                 set auth_token = ?
                 where email = ?`;
    await conn.query(sql, [token, email]);
    conn.release();
}


exports.updateLogoutToken = async function (user_id) {
    const conn = await db.getPool().getConnection();
    const sql = `update user
                 set auth_token = NULL
                 where id = ?`;
    await conn.query(sql, user_id);
    conn.release();
}


exports.checkInput = async function (parameter) {
    let valid = true;

    if (parameter.email) {
        valid = await checkEmail(parameter.email);
    }

    if (parameter.password) {
        if (parameter.password.length < 1) {
            valid = false;
        } else {
            if (!parameter.currentPassword) {
                valid = false;
            }
        }
    }
    return valid;

}

// EVENT ATTENDANCE====================================================================================================

exports.findAccepted = async function (arr) {
    let ans = [];
    for (const item of arr) {
        if (item.status === 'accepted') {
            ans.push(item);
        }
    }
    return ans;
}

exports.findAcceptedAndSelf = async function (arr, user_id) {
    let ans = [];
    for (const item of arr) {
        if (item.status === 'accepted' || item.attendeeId === user_id) {
            ans.push(item);
        }
    }
    return ans;
}


exports.validStatus = async function (status) {
    const reference_status = ["accepted", "pending", "rejected"];
    return reference_status.includes(status);
}

exports.findStatusId = async function (status) {
    let status_id;
    switch (status) {
        case "accepted":
            status_id = 1;
            break;
        case "pending":
            status_id = 2;
            break;
        case "rejected":
            status_id = 3;
            break;
    }
    return status_id;
}
