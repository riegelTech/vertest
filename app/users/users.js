'use strict';

const crypto = require('crypto');

const _ = require('lodash');
const getNamespace = require('cls-hooked').getNamespace;
const uuidV4 = require('uuidv4');

const dbConnector = require('../db/db-connector');

const minutesInHour = 60;
const secondsInMinute= 60;
const milliseconds = 1000;

let sessionMaxDuration;
let sessionInactivityDelay;

const SUPER_ADMIN_LOGIN = 'admin';

const sessions = new Map();

function setSessionDurations(maxDurationMinutes = 3 * minutesInHour, inactivityDelayMinutes = 10) {
	sessionMaxDuration = maxDurationMinutes * secondsInMinute;
	sessionInactivityDelay = inactivityDelayMinutes * secondsInMinute;
}


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
		this._lastActivity = Date.now();
	}

	get user() {
		return this._user;
	}

	get isValid() {
		const overallDelay = sessionMaxDuration * milliseconds;
		const inactivityDelay = sessionInactivityDelay * milliseconds;
		const expirationDate = this._date + overallDelay;
		const inactivityMaxDate = this._lastActivity + inactivityDelay;

		return expirationDate > Date.now() && inactivityMaxDate > Date.now();
	}

	setLastActivity() {
		this._lastActivity = Date.now()
	}
}

class User {
	constructor({_id = uuidV4.uuid(), login = '', password = '', email = '', firstName = '', lastName = '', readOnly = true, hashPass = false}) {
		// TODO some params validations
		this._id = _id;
		this.login = login;
		this.password = hashPass ? User.hashPass(password) : password;
		this.email = email;
		this.firstName = firstName;
		this.lastName = lastName;
		this.readOnly = this.login === User.superAdminLogin ? false : readOnly;
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
	const coll = await dbConnector.getCollection(dbConnector.DB_TABLES.USERS);
	const cursor = await coll.find();
	const itemsCount = await cursor.count();
	if (itemsCount > 0){
		return (await cursor.toArray()).map(rawUser => new User(rawUser));
	}
	const err = new Error('No user found in database');
	err.code = 'ENOUSERFOUND';
	throw err;
}

async function getUser(userId) {
	const coll = await dbConnector.getCollection(dbConnector.DB_TABLES.USERS);
	const cursor = await coll.find({_id: userId});
	const itemsCount = await cursor.count();
	if (itemsCount > 0){
		return new User((await cursor.toArray())[0]);
	}
	const err = new Error(`No user found with ID "${userId}" in database`);
	err.code = 'EUSERNOTFOUND';
	throw err;
}

async function getSuperAdmin() {
	const coll = await dbConnector.getCollection(dbConnector.DB_TABLES.USERS);
	const cursor = await coll.find({login: User.superAdminLogin});
	const itemsCount = await cursor.count();
	if (itemsCount > 0){
		return new User(await cursor.next());
	}
	return null;
}

async function addUser(userProps) {
	const newUser = new User(Object.assign(userProps, {hashPass: true}));
	const coll = await dbConnector.getCollection(dbConnector.DB_TABLES.USERS);
	const sameUserNumber = await coll.find({
		login: newUser.login
	}).count();
	if (sameUserNumber > 0) {
		const errUserExists = new Error('User already exists');
		errUserExists.code = 'EUSEREXISTS';
		throw errUserExists;
	}

	return coll.insertOne(newUser);
}

async function updateUser(userProps) {
	const currentUser = getCurrentUser();
	userProps.hashPass = true;
	const updatedUser = new User(userProps);
	
	if (!currentUser.isSuperAdmin && currentUser.login !== updatedUser.login) {
		const errUserNotEditable = new Error('Only super admin or user itself can edit a user');
		errUserNotEditable.code = 'EUSERNOTEDITABLE';
		throw errUserNotEditable;
	}

	const coll = await dbConnector.getCollection(dbConnector.DB_TABLES.USERS);
	const oldUserCursor = await coll.find({
		_id: updatedUser._id
	});
	if ((await oldUserCursor.count()) !== 1) {
		const errUserNotFound = new Error(`No user found with ID ${updatedUser._id}`);
		errUserNotFound.code = 'EUSERNOTFOUND';
		throw errUserNotFound;
	}
	const oldUser = new User(await oldUserCursor.next());

	if (updatedUser.login !== oldUser.login) {
		const errUserConstraints = new Error('Cannot modify user login');
		errUserConstraints.code = 'EBADUSERDATA';
		throw errUserConstraints;
	}
	return await coll.updateOne({_id: updatedUser._id}, {$set: updatedUser});
}

async function deleteUser(uuid) {
	const currentUser = getCurrentUser();

	if (!currentUser.isSuperAdmin) {
		const errUserNotEditable = new Error('Only super admin can delete a user');
		errUserNotEditable.code = 'EUSERNOTEDITABLE';
		throw errUserNotEditable;
	}

	const coll = await dbConnector.getCollection(dbConnector.DB_TABLES.USERS);
	const userToDeleteCursor = await coll.find({
		_id: uuid
	});
	if ((await userToDeleteCursor.count()) !== 1) {
		const errUserNotFound = new Error(`No user found with ID ${updatedUser._id}`);
		errUserNotFound.code = 'EUSERNOTFOUND';
		throw errUserNotFound;
	}
	const userToDelete = new User(await userToDeleteCursor.next());

	if (userToDelete.isSuperAdmin) {
		const errUserConstraints = new Error('Cannot delete super admin');
		errUserConstraints.code = 'EUSERNOTEDITABLE';
		throw errUserConstraints;
	}

	return await coll.deleteOne({_id: uuid});
}

async function authenticate(login, pass, sessId) {
	const sessionCls = getNamespace('sessions');

	function augmentUserProps(user) {
		return _.omit(Object.assign({}, user, {
			isSuperAdmin: user.isSuperAdmin
		}), ['password']);
	}

	if (sessId && sessions.has(sessId)) {
		const session = sessions.get(sessId);
		if (session.isValid) {
			sessionCls.set('user', augmentUserProps(session.user));
			sessionCls.set('sessId', sessId);
			session.setLastActivity();
			return true;
		} else {
			session.delete(sessId);
			return false;
		}
	}

	const users = await getUsers();
	if (!users.find(userItem => userItem.login === login)) {
		return false;
	}

	const hashedPass = User.hashPass(pass);
	const foundUser = users.find(user => {
		return user.login === login && user.password === hashedPass;
	});

	if (foundUser) {
		const newSessId = uuidV4.uuid();
		sessions.set(newSessId, new Session(foundUser));
		sessionCls.set('user', augmentUserProps(foundUser));
		sessionCls.set('sessId', newSessId);
		return true
	}

	return false
}

function deauthenticate(sessId) {
	if (sessId && sessions.has(sessId)) {
		const session = sessions.get(sessId);
		if (session.isValid) {
			session.delete(sessId);
		}
	}
	return true;
}

function getUserBySessId(sessId) {
	if (sessId && sessions.has(sessId)) {
		const session = sessions.get(sessId);
		if (session.isValid) {
			return session.user;
		}
	}
	return null;
}

function getCurrentUser () {
	const sessionCls = getNamespace('sessions');
	return sessionCls.get('user');
}


module.exports = {
	setSessionDurations,
	authenticate,
	deauthenticate,
	getUsers,
	getUser,
	getUserBySessId,
	getSuperAdmin,
	addUser,
	updateUser,
	deleteUser,
	User,
	getCurrentUser,
	getSessId() {
		const sessionCls = getNamespace('sessions');
		return sessionCls.get('sessId');
	}
};
