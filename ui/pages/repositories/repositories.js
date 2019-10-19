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
            repositories: []
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
        }
    }
}