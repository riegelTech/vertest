'use strict';

import Vue from "vue";

export default () => {
	Vue.filter('shortenGitSha', function (value) {
		const defaultLength = 5;
		if (!value) return '';
		value = value.toString();
		if (value.length <= defaultLength) {
			return value;
		}
		return value.substring(0, defaultLength);
	});
	Vue.filter('shortenGitMessage', function (value) {
		const defaultLength = 30;
		if (!value) return '';
		value = value.toString();
		if (value.length <= defaultLength) {
			return value;
		}
		return `${value.substring(0, defaultLength)} ...`;
	});
	const authorNameRe = /(.*?)\s<.*/g;
	const authorEmailRe = /.*?\s<(.*)>/g;
	Vue.filter('gitAuthorName', function (value) {
		if (!value) return '';
		value = value.toString();
		return value.replace(authorNameRe, '$1');
	});
	Vue.filter('gitAuthorEmail', function (value) {
		if (!value) return '';
		value = value.toString();
		return value.replace(authorEmailRe, '$1');
	});
}
