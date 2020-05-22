'use strict';

const express = require('express');
const gitCommands = require('./gitCommands');

let httpServer;
let log;

async function createHttpServer({gitRepository = null, allowedUser = '', allowedPassword = '', debug = false}) {

	log = debug ? console.log : () => undefined;

	const app = express();
	app.use(express.json());

	app.use((req, res, next) => {
		const auth = {login: allowedUser, password: allowedPassword}; // change this
		const b64auth = (req.headers.authorization || '').split(' ')[1] || '';
		const [login, password] = Buffer.from(b64auth, 'base64').toString().split(':');
		if (login && password && login === auth.login && password === auth.password) {
			return next()
		}

		// Access denied...
		res.set('WWW-Authenticate', 'Basic realm="401"');
		res.status(401).send('Authentication required.');
	});

	app.all('/*', async function (req, res) {
		console.log(req.method);
		const method = req.method;
		const command = req.query.service;
		const demand = req.params[0].substring(req.params[0].indexOf('/'));
		log(command, demand);

		const buf = Buffer.alloc(0);
		const resp = await gitCommands.sendUploadPackRefs(buf, gitRepository);
		console.log(buf.toString());
		res.send(buf.toString());
		// res.send('hello world')
	});

	return new Promise(res => {
		httpServer = app.listen(0, () => {
			res(httpServer.address());
			log('server started');
		});
	});
}

async function tearDownHttpServer() {
	return new Promise(res => {
		httpServer.close(function (err) {
			log('server closed');
			res();
		});
	});
}

module.exports = {
	createHttpServer,
	tearDownHttpServer
};