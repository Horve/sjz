define(['../core/core', './jump', './component/dialog', '../src/order'], function(core, checkUsr, dialog, OrderConfig) {
	core.onrender("kf-style-2-0", function(dom) {
		/*-webkit-animation: .5s detail-price-199;*/
		// 设置跳转返回目标页
		localStorage.setItem("_prepage", window.location.href);
		
		var baseUrl = "http://www.s-jz.com/pub/Sbuild/";
		var kftype = location.hash.replace(/#!_/,"") || "art";
		var productStyle = "";
		var Tools = core.Tools
			, EL_comparePic = $('.area-compare .onhide');
		
		$(document).on('click', '.area-compare .onhide', function() {
			$(this).removeClass('onhide').addClass('onshow').siblings().addClass('onhide');
		});	
	});
});