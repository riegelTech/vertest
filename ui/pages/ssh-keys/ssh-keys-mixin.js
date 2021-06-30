'use strict';

export const SSH_KEYS_API_PATH = '/api/ssh-keys/';
export const sshKeysMixin = {
	data() {
		return {
			sshKeys: []
		};
	},
	methods: {
		async getSshKeys(forceRefresh) {
			if (!forceRefresh && this.$store.state.sshKeys.length > 0) {
				this.sshKeys = this.$store.state.sshKeys;
				return this.sshKeys;
			}
			try {
				const response = await this.$http.get(SSH_KEYS_API_PATH);
				if (response.status === 200) {
					this.$store.commit('sshKeys', response.body);
					this.sshKeys =  response.body;
					return this.sshKeys;
				}
			} catch (resp) {
				return false;
			}
		}
	}
};
