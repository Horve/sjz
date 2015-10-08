define(['../core/core'], function(core) {
	core.onrender("user-new-yingzhuang", function(dom) {
		/*-webkit-animation: .5s detail-price-199;*/
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
	});
});