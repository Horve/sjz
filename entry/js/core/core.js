define(['../lib/zepto', './tools','../lib/avalon.modern.shim','../lib/swiper.js'], function(zepto, tools, avalon) {
	// return $;
	var core = {};
	core.Tools = tools;
	// core.Swiper = swiper;
	core.onrender = function(id, callback) {
		var dom = $('.page');
		if(dom.attr("data-render-id") === id) {
			callback(dom);
		}
	};
	return core;
});