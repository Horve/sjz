define(['../core/core', '../src/order'], function(core, OrderConfig) {
	core.onrender("user-new-yingzhuang", function(dom) {
		/*-webkit-animation: .5s detail-price-199;*/
		var baseUrl = "http://www.s-jz.com/pub/Sbuild/";
		var productStyle = "艺术学院";
		var isQQUC = /(ucbrowser)|(mqqbrowser)/.test(navigator.userAgent.toLowerCase());
		var u = navigator.userAgent;
		var isAndroid = u.indexOf('Android') > -1 || u.indexOf('Linux') > -1; //android终端或者uc浏览器
		var Tools = core.Tools;
		if (isAndroid) {
			var h1 = Tools.calcSepHeight(96, 2);
			var w1 = Tools.calcSepHeight(6, 2, "h");
			var h2 = Tools.calcSepHeight(140, 1, "a");
			console.log(h1,w1,h2);
			$('.yingzhuang-li-comm .list .lrow', dom).css("height", h1 + "px");
			$('.yingzhuang-li-comm .list .lcol', dom).css("width", w1 + "px");
			$('.swiper-slide-yingzhuang-six .container', dom).css("height", h2 + "px");

			var h3 = Tools.calcSepHeight(0, 8, "a", $('.swiper-slide-yingzhuang-six .container', dom));
			$('.swiper-slide-yingzhuang-six .container .row', dom).css("heiht", h3 + "px");

			$('html').removeClass("ios").addClass("android");
		} else {
			$('html').removeClass("android").addClass("ios");
		}
		var sliders = $('.swiper-slide', dom);
		var mySwiper2 = new Swiper('.swiper-container-v1',{
			pagination: '.swiper-pagination-h1',
			direction: 'vertical',
			onSlideChangeEnd: function(swiper){
				var index = swiper.activeIndex;
				// 延迟加载
				var imgs = $('img', $(sliders[index])).concat($('img', $(sliders[index + 1])));
				[].forEach.call(imgs, function(img) {
					var src = $(img).attr("data-src");
					if (src) {
						$(img).attr("src", src);
						$(img).removeAttr("data-src");
					}
				});
			}
		});

		// style
		var styleLis = $('.user-choose-list ul li', dom);
		styleLis.off('click').on('click', function() {
			$(this).addClass("on").siblings().removeClass("on");
			productStyle = $(this).find('span').html();
		});

		$('.order', dom).off('click').on('click', function() {
			var params = '"acreage":100,"balconyNum":1,"toiletNum":1,"productStyle":"' + productStyle + '"';
    		OrderConfig.addOrderAjax(2, params);
		});
		$('.shopcart', dom).off('click').on('click', function() {
			var params = '"acreage":100,"balconyNum":1,"toiletNum":1,"productStyle":"' + productStyle + '"';
    		OrderConfig.addToShopChart(2, params);
		});
	});
});