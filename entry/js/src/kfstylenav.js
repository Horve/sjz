define(['../core/core', './jump', './component/dialog', '../src/order'], function(core, checkUsr, dialog, OrderConfig) {
	core.onrender("kf-style", function(dom) {
		/*-webkit-animation: .5s detail-price-199;*/
		// 设置跳转返回目标页
		localStorage.setItem("_prepage", window.location.href);
		var Tools = core.Tools;
		var baseUrl = Tools.returnBaseUrl();
		var kftype = location.hash.replace(/#!_/,"") || "art";
		var productStyle = "";
		
		var imgs = $('img', $('.swiper-container'));
		var items = $('.choose-style .items span', dom);
		var itemsTxt = $('.choose-style .items-intro', dom);
		var itemsPrice = $('.choose-style .price', dom);
		var swipcnt = $('.swiper-container', dom);
		var layout = 1;
		var nums = null;
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

		var kfvm = avalon.define({
			$id: "root",
			price: 3600,
			txt: "一室一厅（开间）"
		});
		avalon.scan();

		switch(kftype) {
			case "art": 
				productStyle = "艺术学院";
				break;
			case "mag": 
				productStyle = "魔法学院";
				break;
			case "nav": 
				productStyle = "海军学院";
				break;
			case "cau": 
				productStyle = "人文学院";
				break;
		}

		$(items).off('click').on('click', function() {
			var index = $(this).index();
			$(this).addClass("on").siblings().removeClass("on");
			var txt = "";
			var price = 0;
			switch(index) {
				case 0: 
					txt = "一室一厅（开间）";
					price = 3600;
					layout = 1;
					nums = null;
					break;
				case 1: 
					txt = "二室一厅";
					price = 5499;
					layout = 2;
					nums = null;
					break;
				case 2: 
					txt = "三室一厅";
					price = 7399;
					layout = 3;
					nums = null;
					break;
				case 3: 
					txt = "一个卧室";
					price = 1999;
					layout = null;
					nums = 1;
					break;
			}
			// itemsTxt.html(txt);
			// itemsPrice.html(price);
			kfvm.price = price;
			kfvm.txt = txt;
		});
		var imgLists = $('img', '.pic-lists');
    	Tools.lazyLoad(imgLists);

    	$('.ordernow').off('click').on('click', function() {
    		var location = window.location.href;
    		var params = "";
    		if (!!nums) {
    			params = '"nums": 1,"productStyle":"' + productStyle + '"';
    		} else {
    			params = '"layout": ' + layout + ',"productStyle":"' + productStyle + '"';
    		}
    		OrderConfig.addOrderAjax(1, params);
    		// $.ajax({
    		// 	url:  baseUrl + "orderCtrl/addOrder.htm",
    		// 	data: {"ordersStr": '{"orders": [{"productId": 1, ' + params + '}]}'},
    		// 	dataType: "json",
    		// 	success: function(res) {
    		// 		var code = res.ret;
    		// 		// 未登录
    		// 		if (code == 302) {
    		// 			checkUsr.doJump();
    		// 		} else if (code == 1) {
    		// 			// 已登录 进入购物车
    		// 			checkUsr.toShopChart();
    		// 		} else if (code == -1) {
    		// 			// 登录失败。提示重试
    		// 			alert("登录失败！");
    		// 		}
    		// 	}
    		// });
    	});
    	$('.shopchart').off('click').on('click', function() {
    		var location = window.location.href;
    		var params = "";
    		if (!!nums) {
    			params = '"nums": 1,"productStyle":"' + productStyle + '"';
    		} else {
    			params = '"layout": ' + layout + ',"productStyle":"' + productStyle + '"';
    		}
    		OrderConfig.addToShopChart(1, params);
    	});
	});
});