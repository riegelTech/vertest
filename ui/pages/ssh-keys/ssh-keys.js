'use strict';


import Vue from 'vue';
import VueMaterial from 'vue-material';
import VueResource from 'vue-resource';

Vue.use(VueMaterial);
Vue.use(VueResource);

import MainLayout from '../../layouts/main.vue';

const SSH_KEYS_API_PATH = '/api/ssh-keys/';

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
				window.location.href = '/';
			}
		}
	}
};

export default {
	components: {
		MainLayout
	},
	mixins: [sshKeysMixin],
	data() {
		return {
			keyPopin: {
				show: false,
				keyName: '',
				keyPass: ''
			}
		}
	},
	mounted() {
		return this.getSshKeys();
	},
	methods: {
		unlockPrivKey(keyName) {
			this.keyPopin.keyName = keyName;
			this.keyPopin.show = true;
		},
		async sendKeyPass() {
			const keyNameEncoded = encodeURIComponent(this.keyPopin.keyName);
			try {
				const response = await this.$http.post(`${SSH_KEYS_API_PATH}${keyNameEncoded}/key-pass`, {
					keyPass: this.keyPopin.keyPass
				});
				if (response.status !== 200) {
					alert(response.body);
					return;
				}
				this.keyPopin.show = false;
				this.keyPopin.keyPass = '';
				await this.getSshKeys(true);
			} catch (e) {
				alert('Key password update failed');
			}
		}
	}
}