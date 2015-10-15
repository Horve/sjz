define(['../core/core'], function(core) {
	core.onrender("user-new-jiaju", function(dom) {
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
		var u = navigator.userAgent;
		var isAndroid = u.indexOf('Android') > -1 || u.indexOf('Linux') > -1; //android终端或者uc浏览器
		var Tools = core.Tools;
		if (isAndroid) {
			var h = Tools.calcSepHeight(0, 3);
			$('.ruanzhuang-show-comm .content .col', dom).css("height", h + "px");
			$('.swiper-slide-jiaju-three .item-show', dom)
			.css(
				"marginLeft", 
				$('.swiper-slide-jiaju-three .content').width() - 114 + "px"
			);
		}
		var sliders = $('.swiper-slide', dom);
		var mySwiper2 = new Swiper('.swiper-container-v3',{
			pagination: '.swiper-pagination-h3',
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