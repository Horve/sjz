define(['../core/core', './component/slideOptions', './component/dialog', './jump', './order'], function(core, slideOption, dialog, checkUsr, OrderConfig) {
	core.onrender("payment-2-0", function(dom) {
		/*-webkit-animation: .5s detail-price-199;*/
		// 设置跳转返回目标页
		localStorage.setItem("_prepage", window.location.href);
		var Tools = core.Tools
		var baseUrl = Tools.returnBaseUrl();
		if (localStorage.getItem("_prepage")) {
			localStorage.removeItem("_prepage");
		}
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
			totalPrice: 0,
			productId: 1,
			selectedPayState: 0,
			selectedOrderInfo: null,
			showAlert: false,
			orderTopay: "",
			payBtnState: true,
			orderDelete: "",
			selectOrder: function(orderId, totalPrice, productId, paystate, index) {
				VM_shopchart.orderTopay = orderId;
				VM_shopchart.totalPrice = totalPrice;
				VM_shopchart.productId = productId;
				VM_shopchart.selectedPayState = paystate;
				VM_shopchart.selectedOrderInfo = VM_shopchart.orderList[index];
				if (VM_shopchart.totalPrice > 0) {
					VM_shopchart.payBtnState = true;
				} else {
					VM_shopchart.payBtnState = false;
				}
			},
			getOrder: function(orderStep) {
				$.ajax({
					// 未完成订单
					url: baseUrl + "orderCtrl/getOrders.htm?type=" + orderStep,
					dataType: "json",
					success: function(res) {
						if (res.ret == 1) {
							// alert(JSON.stringify(res));
							VM_shopchart.orderList = res.orderInfos;
							VM_shopchart.selectedOrderInfo = VM_shopchart.orderList[0];
							VM_shopchart.orderTopay = res.orderInfos[0].orderId;
							VM_shopchart.totalPrice = res.orderInfos[0].total;
							VM_shopchart.orderStep = orderStep;
							VM_shopchart.productId = res.orderInfos[0].productId;
							if (VM_shopchart.totalPrice > 0) {
								VM_shopchart.payBtnState = true;
							} else {
								VM_shopchart.payBtnState = false;
							}
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
			},
			payOrder: function() {
				if (VM_shopchart.totalPrice > 0) {
					VM_shopchart.wxPay_qianzheng(VM_shopchart.productId);
					VM_shopchart.payBtnState = true;
				} else {
					VM_shopchart.payBtnState = false;
				}
			},
			deleteOrder: function(orderId) {
				VM_shopchart.showAlert = true;
				VM_shopchart.orderDelete = orderId;
			},
			delok: function() {
				VM_shopchart.ajaxCancelOrder(VM_shopchart.orderDelete);
			},
			delcancel: function() {
				VM_shopchart.showAlert = false;
			},
			ajaxCancelOrder: function(id) {
				console.log(id);
				var This = this;
				$.ajax({
					url: baseUrl + "orderCtrl/cancelOrder.htm?orderId=" + id,
					dataType: "json",
					success: function(res) {
						console.log(res);
						if (res.ret == 1) {
							$('#order_' + id).remove();
							if (id == VM_shopchart.selectedOrderInfo.orderId) {
								VM_shopchart.selectedOrderInfo = null;
							}
						} else {
							dialog.add("Error code:" + res.ret + ",Error msg:" + res.msg);
						}
						VM_shopchart.showAlert = false;
					},
					error: function(err) {
						console.log(err);
					}
				});
			},
			// js-jdk签证所需信息
			wxPay_qianzheng: function(type) {
				$.ajax({
					url: baseUrl + "wxsingctrl/sigin.htm?url=" + window.location.href,
					dataType: "json",
					success: function(res) {
						// alert(JSON.stringify(res));
						VM_shopchart.wxPay_getParams(type);
					},
					error: function(res) {
						alert(JSON.stringify(res));
					}
				});
			},
			// 获取支付方法所需参数 payState 支付阶段（0:99/1:结算） type 产品类型(硬装/翻新)
			wxPay_getParams: function(type) {
				if (!VM_shopchart.selectedOrderInfo) {
					dialog.add("还没选择要支付的订单！");
					return;
				}
				var params = "";
				// dialog.add("type:" + type);
				if (type == 2) {
					// 硬装
					var paystep, // 可支付进度的id
						stepInfos = VM_shopchart.selectedOrderInfo.stepInfos;
					for (var i = 0, n = stepInfos.length; i < n; i++) {
						if (stepInfos[i].state == 0) {
							paystep = stepInfos[i].stepId;
							break;
						}
					}
					// alert("payStep:" + paystep);
					if (!!!paystep) {
						dialog.add("当前选中的订单无可支付项！");
						return;
					}
					params = "&stepId=" + paystep + "&isFirst99=false";
				} else {
					params = "&isFirst99=false";
				}
				// alert(params);
				$.ajax({
					url: baseUrl + "pay/preparePay.htm?orderIds=" 
						+ VM_shopchart.orderTopay 
						+ params,
					dataType: "json",
					success: function(res) {
						// alert(JSON.stringify(res));
						try {
							if (res.ret == 1) {
								// 成功获取参数
								function onBridgeReady(){
									WeixinJSBridge.invoke('getBrandWCPayRequest', {
											"appId": "wx4d6a2dce4f09dfd0", //公众号名称，由商户传入     
											"timeStamp": res.timeStamp, //时间戳，自1970年以来的秒数     
											"nonceStr": res.nonceStr, //随机串     
											"package": res.package,     
											"signType": res.signType, //微信签名方式：     
											"paySign": res.paySign //微信签名 
										},
										function(res){     
											if(res.err_msg == "get_brand_wcpay_request:ok" ) {
												VM_shopchart.getOrder(2); // 跳到已支付
											}
										}
									); 
								}
								if (typeof WeixinJSBridge == "undefined"){
									if( document.addEventListener ){
									   document.addEventListener('WeixinJSBridgeReady', onBridgeReady, false);
									}else if (document.attachEvent){
									   document.attachEvent('WeixinJSBridgeReady', onBridgeReady); 
									   document.attachEvent('onWeixinJSBridgeReady', onBridgeReady);
									}
								}else{
									onBridgeReady();
								}
							} else {
								dialog.add("Error code:" + res.ret + ",Error msg:" + res.msg);
							}
						} catch(e) {
							alert(JSON.stringify(e));
						}
					},
					error: function(res) {
						alert(JSON.stringify(res));
					}
				});
			}
		});
		VM_shopchart.getOrder(1);
		avalon.scan();

		$(dom).off('click').on('click', '.step-control', function(e) {
			var id;
			e.stopPropagation();
			e.preventDefault();
			if($(this).hasClass('show-step')) {
				id = $(this).attr('id').replace('ordershow_', "");
				$('#stepcontent_' + id).show();
				$('#ordershow_' + id).hide();
			} else if ($(this).hasClass('close-step')) {
				id = $(this).attr('id').replace('orderclose_', "")
				$('#stepcontent_' + id).hide();
				$('#ordershow_' + id).show();
			}
		});
	});
});