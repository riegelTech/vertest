'use strict';

const fs = require('fs');
const path = require('path');

const { VueLoaderPlugin } = require('vue-loader');

module.exports = {
	mode: 'development',
	devServer: {
		hot: true,
		watchOptions: {
			poll: true
		}
	},
	entry: './ui/app.js',
	output: {
		path: path.resolve(__dirname, 'ui/dist'),
		filename: 'app.js'
	},
	module: {
		rules: [
			{
				test: /\.vue$/,
				loader: 'vue-loader'
			},
			{
				test: /\.scss$/,
				use: [
					'vue-style-loader',
					'css-loader',
					'sass-loader'
				]
			}
		]
	},
	plugins: [
		new VueLoaderPlugin()
	]
};