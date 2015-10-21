define(['../core/core', './component/slideOptions'], function(core, slideOption) {
	core.onrender("shop-cart", function(dom) {
		/*-webkit-animation: .5s detail-price-199;*/
		var Tools = core.Tools;
		// 初始化价格
		var priceInit = {
			kuaifan: 3600,
			bathroom: 50000
		};
		var kfOrder = $('.kuaifan-order', dom)
			, yzOrder = $('.yingzhuang-order', dom)
			, chooseBtns = $('.choose-cbtn');
		slideOption.add($('.kf-house'), {
			title: "选择居室 - 快翻套餐",
			data: [
				{
					id: 1,
					txt: "一居室",
					price: 3600
				},
				{
					id: 2,
					txt: "二居室",
					price: 6200
				},
				{
					id: 3,
					txt: "三居室",
					price: 8500
				},
				{
					id: 4,
					txt: "单间",
					price: 1999
				}
			],
			choose: true, // 是否是选项列表
			// 设置初始选项 不设置为null
			initOption: function(el, datas) {
				$(el).find('input').val(datas[0].txt);
				$(el).find('input').attr("data-id", datas[0].id);
			},
			callback: function(data) {
				$('.kf-house input').val(data.txt);
				$('.kf-house input').attr("data-id", data.id);
				console.log(data);
				priceInit.kuaifan = data.price;
				console.log(priceInit);
			}
		});
		slideOption.add($('.yz-bathroom'), {
			title: "选择卫生间 - 硬装套餐",
			data: [
				{
					id: 1,
					txt: "一个卫生间"
				},
				{
					id: 2,
					txt: "两个卫生间"
				}
			],
			choose: true, // 是否是选项列表
			// 设置初始选项 不设置为null
			initOption: function(el, datas) {
				$(el).find('input').val(datas[0].txt);
				$(el).find('input').attr("data-id", datas[0].id);
			},
			callback: function(data) {
				$('.yz-bathroom input').val(data.txt);
				$('.yz-bathroom input').attr("data-id", data.id);
			}
		});
		slideOption.add($('.yz-platform'), {
			title: "选择居室 - 快翻套餐",
			data: [
				{
					id: 1,
					txt: "一个阳台"
				},
				{
					id: 2,
					txt: "两个阳台"
				}
			],
			choose: true, // 是否是选项列表
			// 设置初始选项 不设置为null
			initOption: function(el, datas) {
				$(el).find('input').val(datas[0].txt);
				$(el).find('input').attr("data-id", datas[0].id);
			},
			callback: function(data) {
				$('.yz-platform input').val(data.txt);
				$('.yz-platform input').attr("data-id", data.id);
			}
		});

		// 选择与放弃选择
		chooseBtns.off('click').on('click', function() {
			if ($(this).hasClass('on')) {
				$(this).removeClass('on');
			} else {
				$(this).addClass('on');
			}
		});

		var shopCart = {
			EL_orderLis: $('.order-list', dom),

			init: function() {
				// 请求订单列表
				this.getUnfinishedOrder();
			},
			getUnfinishedOrder: function() {
				var This = this;
				$.ajax({
					// 未完成订单
					url: "http://www.s-jz.com/Sbuild/orderCtrl/getOrders.htm?type=1",
					dataType: "json",
					success: function(res) {
						// alert("ret:" + JSON.stringify(res));
						// alert("ret:" + JSON.stringify(res.orderInfos));
						if (res.ret == 1) {
							// 获取订单信息成功
							var orderList = res.orderInfos;
							var str = "";
							// alert(typeof orderList);
							try	{
								[].forEach.call(orderList, function(order) {
									if (order.productType == 1) {
										var layout = order.layout
											, nums = order.nums
											, inputVal = ""
											, dataid = null;
										if (layout) {
											switch(layout) {
												case 1: 
													inputVal = "一居室";
													dataid = 1;
													break;
												case 2:
													inputVal = "两居室";
													dataid = 2;
													break;
												case 3:
													inputVal = "三居室";
													dataid = 3;
											}
										} else {
											inputVal = "单间";
											dataid = 4;
										}
										// 快翻订单
										str += '\
											<div class="order kuaifan-order">\
											<div class="top-bottom">订单编号：' + order.orderId + '</div>\
											<div class="cnt">\
												<div class="sub-cnt">\
													<div class="name">\
														<i class="iconfont on choose-cbtn" data-type="kuaifan-order">&#xe60b;</i>\
														<span>快翻套餐</span>\
														<a class="delete"><i class="iconfont">&#xe60b;</i>删除</a>\
													</div>\
													<div class="choose">\
														<div class="form-set kf-house">\
															<p class="droplist item">\
																<em></em>\
																<input type="text" placeholder="一居室" value="' + inputVal + '" readonly="readonly" data-id="' + dataid + '">\
																<span><i></i></span>\
															</p>\
														</div>\
													</div>\
												</div>\
											</div>\
											<div class="top-bottom">\
												<span class="date-time">' + order.createTime + '</span>\
												<span class="price">￥' + order.total + '</span>\
											</div>\
										</div>\
										';
									}
								});
								This.EL_orderLis.html(str);
							} catch(err) {
								alert(JSON.stringify(err));
							}
							
						}
					}
				});
			}
		};
		shopCart.init();
	});
});