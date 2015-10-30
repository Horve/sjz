define(['../core/core', '../src/order'], function(core, OrderConfig) {
	core.onrender("user-new-jiadian", function(dom) {
		/*-webkit-animation: .5s detail-price-199;*/
		// 设置跳转返回目标页
		localStorage.setItem("_prepage", window.location.href);
		
		var isQQUC = /(ucbrowser)|(mqqbrowser)/.test(navigator.userAgent.toLowerCase());
		var u = navigator.userAgent;
		var isAndroid = u.indexOf('Android') > -1 || u.indexOf('Linux') > -1; //android终端或者uc浏览器
		var Tools = core.Tools;

		if (isAndroid) {
			var h = Tools.calcSepHeight(0, 3);
			$('.ruanzhuang-show-comm .content .col', dom).css("height", h + "px");
			$('.swiper-slide-jiadian-two .item-show', dom)
			.css(
				"marginLeft", 
				$('.swiper-slide-jiadian-two .bg-content').width() - 114 + "px"
			);
		}
		var lazyLoad = function(imgs) {
			[].forEach.call(imgs, function(img) {
				var src = $(img).attr("data-src");
				if (src) {
					$(img).attr("src", src);
					$(img).removeAttr("data-src");
				}
			});
		};
		var sliders = $('.swiper-slide', dom);
		var mySwiper2 = new Swiper('.swiper-container-v4',{
			pagination: '.swiper-pagination-h4',
			direction: 'vertical',
			onInit: function(swiper){
		    	var index = swiper.activeIndex;
		    	var imgs = $('img', $(sliders[index])).concat($('img', $(sliders[index + 1])));
		    	lazyLoad(imgs);
		    },
			onSlideChangeEnd: function(swiper){
				var index = swiper.activeIndex;
				console.log(index);
				// 延迟加载
				var imgs = $('img', $(sliders[index])).concat($('img', $(sliders[index + 1])));
				lazyLoad(imgs);
			}
		});
		// style
		var productStyle = "艺术学院";
		var styleLis = $('.user-choose-list ul li', dom);
		styleLis.off('click').on('click', function() {
			$(this).addClass("on").siblings().removeClass("on");
			productStyle = $(this).find('span').html();
		});
		// 下单
		var layout = 1;
		$('.order', dom).off('click').on('click', function() {
			params = '"layout": ' + layout + ',"productStyle":"' + productStyle + '"';
    		OrderConfig.addOrderAjax(5, params);
		});
		$('.shopcart', dom).off('click').on('click', function() {
			params = '"layout": ' + layout + ',"productStyle":"' + productStyle + '"';
    		OrderConfig.addToShopChart(5, params);
		});
	});
});