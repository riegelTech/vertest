'use strict';

import Vue from 'vue';
import VueMaterial from 'vue-material';
import VueResource from 'vue-resource';

Vue.use(VueMaterial);
Vue.use(VueResource);

import MainLayout from '../../layouts/main.vue'

const REPOSITORIES_PATH = '/api/repositories/';

export default {
    components: {
        MainLayout
    },
    data() {
        return {
            repositories: [],
            keyPopin: {
                show: false,
                repoAddress: null,
                keyPass: ''
            }
        };
    },
    mounted() {
        return this.initRepositories();
    },
    methods: {
        async initRepositories() {
            try {
                const response = await this.$http.get(REPOSITORIES_PATH);
                if (response.status === 200) {
                    this.repositories = response.body;
                }
            } catch (resp) {
                window.location.href = '/';
            }
        },
        unlockPrivKey(repoId) {
            this.keyPopin.repoAddress = repoId;
            this.keyPopin.show = true;
        },
        async sendKeyPass() {
            const repoAddressEncoded = encodeURIComponent(this.keyPopin.repoAddress);
            console.log(repoAddressEncoded);
            try {
                const response = await this.$http.put(`${REPOSITORIES_PATH}${repoAddressEncoded}/key-pass`, {
                    keyPass: this.keyPopin.keyPass
                });
                if (response.status !== 200) {
                    alert(response.body);
                    return;
                }
                this.keyPopin.show = false;
                this.keyPopin.keyPass = '';
                this.initRepositories();
            } catch (e) {
                alert('Key password update failed');
            }
        }
    }
}