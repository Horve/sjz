module.exports = {
	entry: "./entry/js/entry.js",
	output: {
		filename: "./webpack_build/build.js"
	},
	module: {
		loaders: [
			{test: /\.js$/, loader: "jsx-loader?harmony"}
		]
	},
	resolve: {
		extensions: ["", ".js", ".json"]
	}
};