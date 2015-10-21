define(['../core/core'], function(core) {
	core.onrender("kf-userindex", function(dom) {
		/*-webkit-animation: .5s detail-price-199;*/
		var isQQUC = /(ucbrowser)|(mqqbrowser)/.test(navigator.userAgent.toLowerCase());
		var u = navigator.userAgent;
		var isAndroid = u.indexOf('Android') > -1 || u.indexOf('Linux') > -1; //android终端或者uc浏览器
		var Tools = core.Tools;
		if (isAndroid) {
			var h = Tools.calcSepHeight(68, 4);
			$('.page-two .style', dom).css("height", h + "px");
		}
		var mySwiper1 = new Swiper('.swiper-container',{
			direction: 'vertical'
		});
	});
});