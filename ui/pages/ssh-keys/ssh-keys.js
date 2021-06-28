'use strict';


import Vue from 'vue';
import VueMaterial from 'vue-material';
import VueResource from 'vue-resource';

import {SSH_KEYS_API_PATH, sshKeysMixin} from './ssh-keys-mixin';

Vue.use(VueMaterial);
Vue.use(VueResource);

import MainLayout from '../../layouts/main.vue';

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
					return false;
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