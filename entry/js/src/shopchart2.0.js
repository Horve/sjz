define(['../core/core', './component/slideOptions', './component/dialog', './jump', './order'], function(core, slideOption, dialog, checkUsr, OrderConfig) {
	core.onrender("payment-2-0", function(dom) {
		/*-webkit-animation: .5s detail-price-199;*/
		// 设置跳转返回目标页
		localStorage.setItem("_prepage", window.location.href);

		var baseUrl = "http://www.s-jz.com/test/Sbuild/";
		if (localStorage.getItem("_prepage")) {
			localStorage.removeItem("_prepage");
		}
		var Tools = core.Tools
			
		var stepCal = function(num) {
			if (num == 0) {
				return {txt: "即将开始", on: ""};
			} else if (num == 2) {
				return {txt: "施工中", on: ""};
			} else if (num == 3) {
				return {txt: "验收中", on: ""};
			} else if (num == 4) {
				return {txt: "失败返工", on: ""};
			} else if (num == 5) {
				return {txt: "已完工", on: "on"};
			} else if (num == 1) {
				return {txt: "支付完成", on: "on"};
			}
		};

		var VM_shopchart = avalon.define({
			$id: "root",
			orderStep: 1, // 1 未支付 2 开工中 3 已完工 4 历史订单
			orderList: [],
		});
		avalon.scan();

		var ShopChart = {
			init: function() {
				this.getOrder(1);
			},
			getOrder: function(orderStep) {
				$.ajax({
					// 未完成订单
					url: baseUrl + "orderCtrl/getOrders.htm?type=" + orderStep,
					dataType: "json",
					success: function(res) {
						if (res.ret == 1) {
							VM_shopchart.orderList = res.orderInfos;
							alert(JSON.stringify(res));
						} else if (res.ret == -1) {
							dialog.add("ret:-1 订单列表返回失败，请重试！");
						} else if (res.ret == 302) {
							// dialog.add("需登录！");
							checkUsr.doJump();
						}
					},
					error: function(res) {
						dialog.add(JSON.stringify(res));
					}
				});
			}
		};

		ShopChart.init();
	});
});