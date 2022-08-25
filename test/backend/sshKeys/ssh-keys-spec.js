'use strict';

const chai = require('chai');

const sshKeyModule = require('../../../app/sshKeys/ssh-keys');

chai.should();
const expect = chai.expect;

describe('SSH Key module', function () {

	describe('should instantiate', function () {

		it('with basic arguments', function () {
			// when
			const sshKey = new sshKeyModule.SshKey({
				name: 'some ssh key',
				pubKey: 'path/toPubkey.pub'
			}, false);
			// then
			sshKey.should.be.instanceOf(sshKeyModule.SshKey);
		});

		it('should generate errors when name is missing', function () {
			expect(() => new sshKeyModule.SshKey({
				pubKey: 'path/toPubkey.pub'
			}, false)).to.throw('SSH key config entry must have a valid name');
		});

		it('should generate errors when public key path is missing', function () {
			expect(() => new sshKeyModule.SshKey({
				name: 'some ssh key'
			}, false)).to.throw('SSH key config entry must have a valid public key');
		});
	});
});