define(['../core/core'], function(core) {
	core.onrender("userindex", function(dom) {
		/*-webkit-animation: .5s detail-price-199;*/
		var Tools = core.Tools;
		console.log(Swiper);
		var mySwiper = new Swiper('.swiper-container',{
			// direction: 'vertical'
			onInit: function(swiper){
		    	console.log("init");
		    	$('.swiper-slide-one .txt').addClass("animate_1");
		    	$('.swiper-slide-one .pic').addClass("animate_2");
		    },
			onSlideChangeEnd: function(swiper){
				var index = swiper.activeIndex;
				if (index == 1) {
					$('.swiper-slide-two .txt').addClass("animate_1");
		    		$('.swiper-slide-two .pic').addClass("animate_2");
				}
			}
		});
	});
});