'use strict';

const path = require('path');

const { VueLoaderPlugin } = require('vue-loader');

module.exports = {
	mode: 'production',
	entry: './ui/app.js',
	output: {
		path: path.resolve(__dirname, 'ui/dist'),
		filename: 'app.js'
	},
	resolve: {
		alias: {
			vue: 'vue/dist/vue.js'
		},
		fallback: {
			path: require.resolve('path-browserify')
		}
	},
	module: {
		rules: [
			{
				test: /\.vue$/,
				use: 'vue-loader'
			},
			{
				test: /\.scss$/,
				use: [
					'vue-style-loader',
					'css-loader',
					'sass-loader'
				]
			},
			{
				test: /\.css$/,
				use: [
					'vue-style-loader',
					'css-loader'
				]
			}
		]
	},
	plugins: [
		new VueLoaderPlugin()
	]
};