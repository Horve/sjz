define(['../core/core'], function(core) {
	core.onrender("userproduct", function(dom) {
		/*-webkit-animation: .5s detail-price-199;*/
		var Tools = core.Tools;
		var topNav = $('.topnav', dom);
		var topNavs = $('.topnav .nav-item', dom);
		var sliders = $('.swiper-top', dom);
		console.log(topNav);
		var mySwiper1 = new Swiper('.swiper-container-h',{
			// direction: 'vertical'
			onSlideChangeEnd: function(swiper){
				var index = swiper.activeIndex;
				// topNav.addClass("show");
				$(topNavs[index]).addClass("on").siblings().removeClass("on");

				// 延迟加载
				var imgs = $('img', $(sliders[index]));
				[].forEach.call(imgs, function(img) {
					var src = $(img).attr("data-src");
					if (src) {
						$(img).attr("src", src);
						$(img).removeAttr("data-src");
					}
				});
			}
		});
		var mySwiper2 = new Swiper('.swiper-container-v1',{
			pagination: '.swiper-pagination-h1',
			direction: 'vertical'
		});
		var mySwiper3 = new Swiper('.swiper-container-v2',{
			pagination: '.swiper-pagination-h2',
			direction: 'vertical'
		});
		var mySwiper4 = new Swiper('.swiper-container-v3',{
			pagination: '.swiper-pagination-h3',
			direction: 'vertical'
		});
		var mySwiper5 = new Swiper('.swiper-container-v4',{
			pagination: '.swiper-pagination-h4',
			direction: 'vertical'
		});
	});
});