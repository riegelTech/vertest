'use strict';

const crypto = require('crypto');

const getNamespace = require('cls-hooked').getNamespace;
const uuidV4 = require('uuidv4');

const dbConnector = require('../db/db-connector');

const USERS_COLL_NAME = 'users';
const SESSION_EXPIRATION_DELAY_HOURS = 2;

const SUPER_ADMIN_LOGIN = 'admin';

const sessions = new Map();

const secondsInMinute= 60;
const milliseconds = 1000;
setInterval(() => {
	const deprecatedSessionIds = [];
	sessions.forEach((session, sessionId) => {
		if (!session.isValid) {
			deprecatedSessionIds.push(sessionId);
		}
	});
	deprecatedSessionIds.forEach(deprecatedSessionId => {
		sessions.delete(deprecatedSessionId);
	});
}, secondsInMinute * milliseconds);

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
	constructor({uuid = uuidV4(), login = '', pass = '', email = '', firstName = '', lastName = '', readOnly = true, hashPass = false}) {
		// TODO some params validations
		this._id = uuid;
		this.login = login;
		this.pass = hashPass ? User.hashPass(pass) : pass;
		this.email = email;
		this.firstName = firstName;
		this.lastName = lastName;
		this.readOnly = readOnly;
	}

	static hashPass(clearPass) {
		const hash = crypto.createHash('sha256');
		hash.update(clearPass);
		return hash.digest('hex');
	}

	static get superAdminLogin() {
		return SUPER_ADMIN_LOGIN;
	}

	get isSuperAdmin() {
		return this.login === User.superAdminLogin;
	}
}

async function getUsers() {
	const coll = await dbConnector.getCollection(USERS_COLL_NAME);
	const cursor = await coll.find();
	const itemsCount = await cursor.count();
	if (itemsCount > 0){
		return (await cursor.toArray()).map(rawUser => new User(rawUser));
	}
	const err = new Error('No user found in database');
	err.code = 'ENOUSERFOUND';
	throw err;
}

async function getSuperAdmin() {
	const coll = await dbConnector.getCollection(USERS_COLL_NAME);
	const cursor = await coll.find({login: User.superAdminLogin});
	const itemsCount = await cursor.count();
	if (itemsCount > 0){
		return new User(await cursor.next());
	}
	return null;
}

async function addUser(userProps) {
	const newUser = new User(userProps);
	const coll = await dbConnector.getCollection(USERS_COLL_NAME);
	const sameUserNumber = await coll.find({
		$or:[
			{login: newUser.login},
			{email: newUser.email}
		]
	}).count();
	if (sameUserNumber > 0) {
		const errUserExists = new Error('User already exists');
		errUserExists.code = 'EUSEREXISTS';
		throw errUserExists;
	}

	await coll.insertOne(newUser);
	return newUser;
}

async function authenticate(login, pass, sessId) {
	const sessionCls = getNamespace('sessions');
	if (sessId && sessions.has(sessId)) {
		const session = sessions.get(sessId);
		if (session.isValid) {
			sessionCls.set('user', session.user);
			sessionCls.set('sessId', sessId);
			return true;
		}
		session.delete(sessId);
	}

	const users = await getUsers();
	if (!users.find(userItem => userItem.login === login)) {
		return false;
	}

	const hashedPass = User.hashPass(pass);
	const foundUser = users.find(user => {
		return user.login === login && user.pass === hashedPass;
	});

	if (foundUser) {
		const newSessId = uuidV4();
		sessions.set(newSessId, new Session(foundUser));
		sessionCls.set('user', foundUser);
		sessionCls.set('sessId', newSessId);
		return true
	}

	return false
}


module.exports = {
	authenticate,
	getUsers,
	getSuperAdmin,
	addUser,
	User,
	getCurrentUser() {
		const sessionCls = getNamespace('sessions');
		return sessionCls.get('user');
	},
	getSessId() {
		const sessionCls = getNamespace('sessions');
		return sessionCls.get('sessId');
	}
};
