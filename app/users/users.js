'use strict';

const crypto = require('crypto');

const createNamespace = require('continuation-local-storage').createNamespace;
const getNamespace = require('continuation-local-storage').getNamespace;
const uuid = require('uuidv4');

const dbConnector = require('../db/db-connector');

const USERS_COLL_NAME = 'users';
const SESSION_EXPIRATION_DELAY_HOURS = 2;

const sessions = new Map();
const setSessionCls = createNamespace('sessions');
const getSessionCls = getNamespace('sessions');


class Session {
	constructor(user) {
		this._user = user;
		this._date = Date.now();
	}

	get user() {
		return this._user;
	}

	get isValid() {
		const milliseconds = 1000;
		const secondsMinuteHex = 60;
		const delay = SESSION_EXPIRATION_DELAY_HOURS * secondsMinuteHex * secondsMinuteHex * milliseconds;
		const expirationDate = this._date + delay;

		return expirationDate > Date.now();
	}
}

class User {
	constructor({login = '', pass = '', email = '', firstName = '', lastName = ''}) {
		// TODO some params validations
		this.login = login;
		this.pass = this.hashPass(pass);
		this.email = email;
		this.firstName = firstName;
		this.lastName = lastName;
	}

	static hashPass(clearPass) {
		const hash = crypto.createHash('sha256');
		hash.update(clearPass);
		return hash.digest('hex');
	}

}

async function getUsers() {
	const coll = await dbConnector.getCollection(USERS_COLL_NAME);
	const cursor = await coll.find();
	const itemsCount = await cursor.count();
	if (itemsCount > 0){
		return cursor.toArray();
	}
	const err = new Error('No user found in database');
	err.code = 'ENOUSERFOUND';
	throw err;
}

async function addUser(userProps) {
	const newUser = new User(userProps);
	// TODO
}

async function authenticate(login, pass, sessId) {
	const users = getUsers();

	if (!users.find(userItem => userItem.login === login)) {
		throw new Error('User not found');
	}

	if (sessions.has(sessId)) {
		const session = sessions.get(sessId);
		if (session.isValid) {
			setSessionCls.set('user', session.user);
			setSessionCls.set('sessId', sessId);
			return true;
		}
		session.delete(sessId);
		return false;
	}

	const hashedPass = User.hashPass(pass);
	const foundUser = users.find(user => {
		return user.login === login && user.pass === hashedPass;
	});

	if (foundUser) {
		const newSessId = uuid();
		sessions.set(newSessId, new Session(foundUser));
		setSessionCls.set('sessId', newSessId);
		return true;
	}

	return false;
}

module.exports = {
	authenticate,
	getSessId() {
		return getSessionCls.get('sessId');
	},
	getCurrentUser() {
		return getSessionCls.get('user');
	},
	getUsers,
	addUser
};
