const db = require('../../config/db');
const helper = require('../models/helper.server.model');

//REGISTER AS A NEW USER ==============================================================================================
exports.insertNewUser = async function (parameter) {
    console.log('Request to insert a new user to the database...');
    const conn = await db.getPool().getConnection();
    const sql = `insert into user (email, first_name, last_name, password)
                 values (?, ?, ?, ?)`
    const values = await helper.initUserValues(parameter);
    const [rows] = await conn.query(sql, values);
    conn.release();
    return rows;
}

//LOG IN AS AN EXISTING USER===========================================================================================

exports.logIn = async function (email) {
    console.log('Request to check user info in the database...');
    const conn = await db.getPool().getConnection();
    const sql = `select *
                 from user
                 where email = ?`;
    const [rows] = await conn.query(sql, email);
    conn.release();
    return rows;
}


//LOG OUT THE CURRENTLY AUTHORISED USER================================================================================
exports.findUser = async function (token) {
    console.log('Request to check user Authorization in the database...');
    const conn = await db.getPool().getConnection();
    const sql = `select *
                 from user
                 where auth_token = ?`;
    const [rows] = await conn.query(sql, token);
    conn.release();
    return rows;

}


//RETRIEVE INFO ABOUT A USER===========================================================================================

exports.getUserById = async function (id) {
    console.log('Request to get user info in the database...');
    const conn = await db.getPool().getConnection();
    const sql = `select *
                 from user
                 where id = ?`;
    const [rows] = await conn.query(sql, id);
    conn.release();
    return rows;

}

exports.updateUserPassword = async function (parameter, uer_id) {
    console.log('Request to update password in the database...');
    const conn = await db.getPool().getConnection();

    const sql = `update user set password = ? where id = ?`;
    const new_password = await helper.myHash(parameter.password);
    await conn.query(sql, [new_password, uer_id]);

    conn.release();

}


exports.updateUser = async function (parameter, uer_id) {
    console.log('Request to update other details in the database...');
    const conn = await db.getPool().getConnection();

    if (parameter.firstName) {
        const sql1 = `update user set first_name = ? where id = ? `;
        await conn.query(sql1, [parameter.firstName, uer_id]);
    }

    if (parameter.lastName) {
        const sql2 = `update user set last_name = ? where id = ? `;
        await conn.query(sql2, [parameter.lastName, user_id]);
    }

    if (parameter.email) {
        const sql3 = `update user set email = ? where id = ? `;
        await conn.query(sql3, [parameter.email, user_id]);
    }
    conn.release();
}


//SET AN USER'S HERO IMAGE============================================================================================

exports.updateUserImage = async function (filename, id) {
    console.log(`Request to update the user's profile image file name in the database...`);
    const conn = await db.getPool().getConnection();
    const sql = `update user set image_filename = ? where id = ?`;
    await conn.query(sql, [filename, id]);
    conn.release();
}

//DELETE A USER'S PROFILE IMAGE========================================================================================

exports.deleteUserImage = async function (id) {
    console.log(`Request to delete the user's profile image file name in the database...`);
    const conn = await db.getPool().getConnection();
    const sql = `update user set image_filename = null where id = ?`;
    await conn.query(sql, id);
    conn.release();
}

