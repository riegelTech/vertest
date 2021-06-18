'use strict';

const configModule = require('../appConfig/config');
const logsModule = require('../logsModule/logsModule');

const DEFAULT_STATUSES = [{
	name: 'todo', // The test case isn't affected
	done: false,
	color: '#b0bec5',
	lang: {
		en: 'To do',
		fr: 'A faire'
	}
}, {
	name: 'in progress', // The test case is affected to a user, so he is working on it
	done: false,
	color: '#90caf9',
	lang: {
		en: 'In progress',
		fr: 'En cours'
	}
}, {
	name: 'blocked', // The test case can't be achieved
	done: false,
	color: '#ffcc80',
	lang: {
		en: 'Blocked',
		fr: 'Bloqué'
	}
}, {
	name: 'success', // Test pass !
	done: true,
	color: '#a5d6a7',
	lang: {
		en: 'Successful',
		fr: 'Réussi'
	}
}, {
	name: 'failed', // Test failed !
	done: true,
	color: '#ef9a9a',
	lang: {
		en: 'Failed',
		fr: 'En échec'
	}
}];

class Status {
	constructor({name = '', isDefaultStatus = false, testCaseIsDone = false, lang = {}, color = ''}) {
		if (!name || name.length === 0) {
			throw new Error('A status must have a name');
		}

		this.name = name;
		this.isDefaultStatus = isDefaultStatus;
		this.testCaseIsDone = testCaseIsDone;
		this.lang = lang;
		this.color = color;
	}

	setDefault() {
		this.isDefaultStatus = true;
	}

	getLocalizedStatus(lang) {
		if (!this.lang[lang]) {
			return this.name;
		}
		return this.lang[lang];
	}
}

class Statuses {
	constructor() {
		this.statuses = [];
	}

	clear() {
		this.statuses = [];
	}

	setDefaultStatus(defaultStatus) {
		const existingDefaultStatus = this.statuses.find(status => status.name === defaultStatus.name);
		if (!existingDefaultStatus) {
			throw new Error(`Unable to define status "${defaultStatus.name}" as default status, this status does not exists`);
		}
		existingDefaultStatus.setDefault();
	}

	addStatus(statusToAdd) {
		if (!statusToAdd instanceof Status) {
			throw new Error(`Instance of Status expected, got "${statusToAdd.constructor.name}"`);
		}
		if (this.statuses.find(status => status.name === statusToAdd.name)) {
			throw new Error(`Duplicate status name "${statusToAdd.name}"`);
		}
		this.statuses.push(statusToAdd);
	}

	getStatusByIndex(index) {
		if (index >= this.statuses.length) {
			throw new Error(`Try to read status at index "${index}" while statuses list is ${this.statuses.length} length`);
		}
		return this.statuses[index];
	}

	getStatusByName(statusName) {
		return this.statuses.find(status => status.name === statusName);
	}

	loadDefaultStatuses() {
		this.clear();

		DEFAULT_STATUSES.forEach(statusToAdd => {
			this.addStatus(new Status(statusToAdd));
		});
		this.setDefaultStatus(DEFAULT_STATUSES[0]);
	}
}

const statuses = new Statuses();

// detect a status discordance when configuration changed but existing test cases already have statuses
async function reviewExistingStatuses(testSuites) {
	const problems = [];

	for(let testSuite of testSuites) {
		for (let testCase of testSuite.tests) {
			if (!statuses.getStatusByName(testCase.status.name)) {
				problems.push({
					testSuiteId: testSuite._id,
					testCaseId: testCase.testFilePath,
					currentStatus: testCase.status
				})
			}
		}
	}

	return problems;
}


async function loadStatusesFromConfig() {
	const logger = logsModule.getDefaultLoggerSync();
	const config = await configModule.getAppConfig();

	if (!config.testCaseStatuses) {
		return statuses.loadDefaultStatuses();
	}

	statuses.clear();
	try {
		for (let key in config.testCaseStatuses) {
			if (key !== 'defaultStatus') {
				const confEntry = config.testCaseStatuses[key];
				const status = new Status({
					name: key,
					testCaseIsDone: confEntry.done,
					lang: confEntry.lang,
					color: confEntry.color
				});
				statuses.addStatus(status);
			}
		}
		if (config.testCaseStatuses.defaultStatus) {
			if (!statuses.getStatusByName(config.testCaseStatuses.defaultStatus)) {
				throw new Error(`Failed to define default status, "${config.testCaseStatuses.defaultStatus}" does not exist among configured statuses list`);
			} else {
				statuses.setDefaultStatus(statuses.getStatusByName(config.testCaseStatuses.defaultStatus));
			}
		} else {
			statuses.setDefaultStatus(statuses.getStatusByIndex(0));
		}
	} catch (e) {
		logger.error(`Failed to load statuses from configuration, the default one will be loaded instead: ${e.message}`);
		statuses.loadDefaultStatuses();
	}
}

module.exports = {
	Status,
	getStatuses: () => statuses,
	loadDefaultStatuses: () => statuses.loadDefaultStatuses(),
	loadStatusesFromConfig,
	reviewExistingStatuses
};
