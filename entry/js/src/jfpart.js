define(['../core/core', './jump', './component/dialog', '../src/order'], function(core, checkUsr, dialog, OrderConfig) {
	core.onrender("jf-part", function(dom) {
		/*-webkit-animation: .5s detail-price-199;*/
		var Tools = core.Tools;
		var baseUrl = "http://www.s-jz.com/pub/Sbuild/";
		var swipcnt = $('.swiper-container', dom);
		var imgs = $('img', $('.swiper-container'));
		var chosBtns = $('.price-sec .btn', dom);
		var orderNow = $('.order', dom);
		var addChart = $('.shopcart', dom);
		var initPriceSet = { // 默认平米数set
			6: 10, // 地板默认平米数
			7: 10, // 乳胶漆
			8: 10, // 壁纸
			9: 10, // 瓷砖
			10: 10, // 厨卫天花
			11: 1 // 室内门
		};
		var selected = [6];

		Array.prototype.arrayDelItem = function(item) {
			for (var i = 0, n = this.length; i < n; i++) {
				if (this[i] === item) {
					this.splice(i, 1);
				}
			}
			return this;
		};

		var mySwiper1 = new Swiper('.swiper-container',{
			// direction: 'vertical'
			pagination: '.pagination-style',
			autoplay: 3000,
			onInit: function(swiper){
		    	var width = parseInt(Tools.getCurrentStyle(swipcnt[0], "width"));
		    	var height = width * 0.74375;
		    	swipcnt.css("height", height + "px");
		    	Tools.lazyLoad([imgs[0], imgs[1]]);
		    },
			onSlideChangeEnd: function(swiper){
				var index = swiper.activeIndex;
				// 延迟加载
				Tools.lazyLoad(imgs[index + 1]);
			}
		});
		chosBtns.off('click').on('click', function() {
			var proid = parseInt($(this).attr("data-proid"));
			if ($(this).hasClass("on")) {
				$(this).removeClass("on");
				selected = selected.arrayDelItem(proid);
			} else {
				$(this).addClass("on");
				selected.push(proid);
			}
		});
		// data: {"ordersStr": '{"orders": [{"productId":' + productId + ', ' + params + '}]}'},
		
		// 下单
		$('.shopcart, .order').off('click').on('click', function() {
			var className = $(this).attr("class");
			var params = "";
			[].forEach.call(selected, function(item, index) {
				if (index == (selected.length - 1)) {
					params += '{"productId":' + item + ', "nums":' + initPriceSet[item] + '}';
				} else {
					params += '{"productId":' + item + ', "acreage":' + initPriceSet[item] + '},';
				}
			});
			var dataParam = {"ordersStr": '{"orders": [' + params + ']}'};
			console.dir();
			$.ajax({
				url: baseUrl + "orderCtrl/addOrder.htm",
				data: dataParam,
				dataType: "json",
				success: function(res) {
					// alert(JSON.stringify(res));
					var code = res.ret;
					// 未登录
					if (code == 302) {
						checkUsr.doJump();
						// wxAuth();
					} else if (code == 1) {
						if (/shopcart/.test(className)) {
							// 已登录 提示加入购物车成功
							dialog.add("已成功加入购物车！");
						} else {
							// 已登录 跳转到订单列表
							checkUsr.toShopChart();
						}
					} else if (code == -1) {
						// 登录失败。提示重试
						alert("登录失败！");
					}
				},
				error: function(res) {
					alert(JSON.stringify(res));
				}
			});
		});
	});
});