define(['../core/core'], function(core) {
	core.onrender("kf-style", function(dom) {
		/*-webkit-animation: .5s detail-price-199;*/
		var Tools = core.Tools;
		var imgs = $('img', $('.swiper-container'));
		var items = $('.choose-style .items span', dom);
		var itemsTxt = $('.choose-style .items-intro', dom);
		var itemsPrice = $('.choose-style .price', dom);
		var swipcnt = $('.swiper-container', dom);
		var mySwiper1 = new Swiper('.swiper-container',{
			// direction: 'vertical'
			pagination: '.pagination-style',
			autoplay: 3000,
			onInit: function(swiper){
		    	console.log("init");
		    	var width = parseInt(Tools.getCurrentStyle(swipcnt[0], "width"));
		    	var height = width * 0.6875;
		    	swipcnt.css("height", height + "px");
		    	Tools.lazyLoad([imgs[0], imgs[1]]);
		    },
			onSlideChangeEnd: function(swiper){
				var index = swiper.activeIndex;
				// 延迟加载
				Tools.lazyLoad(imgs[index + 1]);
			}
		});
		$(items).off('click').on('click', function() {
			var index = $(this).index();
			$(this).addClass("on").siblings().removeClass("on");
			console.log(index);
			var txt = "";
			var price = 0;
			switch(index) {
				case 0: 
					txt = "一室一厅";
					price = 3600;
					break;
				case 1: 
					txt = "二室一厅";
					price = 6200;
					break;
				case 2: 
					txt = "三室一厅";
					price = 8500;
					break;
				case 3: 
					txt = "一个卧室";
					price = 1999;
					break;
			}
			itemsTxt.html(txt);
			itemsPrice.html(price);
		});
		var imgLists = $('img', '.pic-lists');
    	Tools.lazyLoad(imgLists);
	});
});