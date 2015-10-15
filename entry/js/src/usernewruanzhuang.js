define(['../core/core'], function(core) {
	core.onrender("user-new-ruanzhuang", function(dom) {
		/*-webkit-animation: .5s detail-price-199;*/
		var lazyLoad = function(imgs) {
			[].forEach.call(imgs, function(img) {
				var src = $(img).attr("data-src");
				if (src) {
					$(img).attr("src", src);
					$(img).removeAttr("data-src");
				}
			});
		};
		var isQQUC = /(ucbrowser)|(mqqbrowser)/.test(navigator.userAgent.toLowerCase());
		var Tools = core.Tools;
		if (isQQUC) {
			var h = Tools.calcSepHeight(0, 3);
			$('.ruanzhuang-show-comm .content .col', dom).css("height", h + "px");
		}
		var sliders = $('.swiper-slide', dom);
		var mySwiper2 = new Swiper('.swiper-container-v2',{
			pagination: '.swiper-pagination-h2',
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
	});
});