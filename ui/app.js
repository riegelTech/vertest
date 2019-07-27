'use strict';

import Vue from 'vue';

import Board from './components/board/board.vue'

const main = new Vue({
	el: '#app-wrapper',
	render: h => h(Board)
});