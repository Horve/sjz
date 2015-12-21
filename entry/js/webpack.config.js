var webpack = require('webpack');
var commonsPlugin = new webpack.optimize.CommonsChunkPlugin("common.js");

module.exports = {
	plugins: [commonsPlugin],
	entry: {
		entry: './entry.js'
	},
	output: {
		path: './dist/',
		filename: '[name].js'
	},
	module: {
		loaders: [
			{test: /\.js/, loader: 'jsx-loader?harmony'}
		]
	},
	resolve: {
		root: '/Users/apple/personal-git',
		extensions: ['', '.js', '.json', '.scss'],
		alias: {
			
		}
	}
};