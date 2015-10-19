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

    	$('.ordernow').off('click').on('click', function() {
    		$.ajax({
    			url: "http://www.s-jz.com/Sbuild/orderCtrl/addOrder.htm",
    			data: {"orders": [{"productId": 1, "layout": 1}]},
    			dataType: "json",
    			success: function(res) {
    				var code = res.ret;
    				alert(code);
    				// 未登录
    				if (code == 302) {
    					// 请求微信授权接口wxf25cf835f9d71720
    					// window.location.href="https://open.weixin.qq.com/connect/oauth2/authorize?appid=wx4d6a2dce4f09dfd0&redirect_uri=http%3A%2F%2Fwww.s-jz.com%2Fhtml%2Fuser&response_type=code&scope=snsapi_userinfo&state=STATE&connect_redirect=1#wechat_redirect";
    					window.location.href="https://open.weixin.qq.com/connect/oauth2/authorize?appid=wxf25cf835f9d71720&redirect_uri=http%3A%2F%2Fwww.s-jz.com%2Fhtml%2Fredirect.html&response_type=code&scope=snsapi_userinfo&state=STATE&connect_redirect=1#wechat_redirect";
    					// wxAuth();
    				} else if (code == 1) {
    					// 已登录 进入购物车
    				} else if (code == -1) {
    					// 登录失败。提示重试
    				}
    			}
    		});
    	});

    	// 请求微信授权接口
    	function wxAuth() {
    		$.ajax({
    			url: "https://open.weixin.qq.com/connect/oauth2/authorize?appid=wx4d6a2dce4f09dfd0&redirect_uri=http%3A%2F%2Fwww.s-jz.com%2Fhtml%2Fuser&response_type=code&scope=snsapi_userinfo&state=STATE&connect_redirect=1#wechat_redirect",
    			dataType: "json",
    			success: function(res) {
    				alert(JSON.stringify(res));
    			},
    			error: function(res) {
    				alert("err:" + JSON.stringify(res));
    			}
    		});
    	}
	});
});