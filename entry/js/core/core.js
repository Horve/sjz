define(['../lib/zepto', './tools'], function(zepto, tools) {
	// return $;
	var core = {};
	core.Tools = tools;
	core.onrender = function(id, callback) {
		var dom = $('.page');
		if(dom.attr("data-render-id") === id) {
			callback(dom);
		}
	}
	return core;
});