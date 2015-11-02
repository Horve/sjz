define(['../core/core', './component/slideOptions', './component/dialog', './jump', './order'], function(core, slideOption, dialog, checkUsr, OrderConfig) {
	core.onrender("shop-cart", function(dom) {
		/*-webkit-animation: .5s detail-price-199;*/
		// 设置跳转返回目标页
		localStorage.setItem("_prepage", window.location.href);

		var baseUrl = "http://www.s-jz.com/pub/Sbuild/";
		var Tools = core.Tools
			, yzOrderDtl = {}
			// 初始化价格
			, priceDetail = {}
			, selectedOrder = ""
			, payState = 1
			, productType = 1
			, kfOrder = $('.kuaifan-order', dom)
			, yzOrder = $('.yingzhuang-order', dom)
			, chooseBtns = $('.choose-cbtn', dom)
			, priceEl = $('#total-price')
			, topNav = $('.order-type .type-item')
			, payButton = $('.gopay')
			, priceTxtEl = $('#price-txt');

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

		var rmArrayItem = function(item, array) {
			var resArr = array;
			for (var i = 0, n = array.length; i < n; i++) {
				if (item == array[i]) {
					resArr.splice(i, 1);
					break;
				}
			}
			return resArr;
		};

		var shopCart = {
			EL_orderLis: $('.order-list', dom),
			init: function() {
				var This = this;
				// 请求订单列表
				this.getOrder(1);
				// 支付事件绑定
				payButton.off('click').on('click', function() {
					// alert(selectedOrder);
					if (!!selectedOrder.length) {
						This.wxPay_qianzheng(payState, productType);
					} else {
						dialog.add("没有选择可支付的订单");
					}
				});
				// 顶部导航点击
				topNav.off('click').on('click', function() {
					var index = $(this).index();
					$(this).addClass('on').siblings().removeClass('on');
					This.getOrder(index + 1);
				});
			},
			// get price
			// _getPrice: function() {
			// 	var total = 0;
			// 	console.log("!!!!");
			// 	console.log(priceDetail);
			// 	for (var i in priceDetail) {
			// 		total += priceDetail[i];
			// 	}
			// 	priceEl.html("￥" + total);
			// },

			// 未选中订单不可选逻辑处理
			_unChooseOrder: function(orders) {
				if (typeof orders === 'object' && Object.prototype.toString.call(orders) === '[object Array]') {
					selectedOrder = [];
				} else {
					selectedOrder = rmArrayItem(orders, selectedOrder);
				}
			},
			// 硬装下拉卫生间绑定事件 initId 初始化时的数量
			_eventBindYZToiletSlide: function(el, id, initId) {
				var This = this;
				slideOption.add(el, {
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
						// ,
						// {
						// 	id: 3,
						// 	txt: "三个卫生间"
						// }
					],
					choose: true, // 是否是选项列表
					// 设置初始选项 不设置为null
					initOption: function(el, datas) {
						// $(el).find('input').val(datas[0].txt);
						$(el).find('input').attr("data-id", datas[0].id);
					},
					callback: function(data) {
						$(el).find('input').val(data.txt);
						$(el).find('input').attr("data-id", data.id);
						var preSelNum = yzOrderDtl[id].toiletNum; //上一次选择的数量
						// switch(data.id) {
						// 	case 1:
						// 		priceDetail[id] = preSelNum > 1 ? priceDetail[id] - 3500 : priceDetail[id];
						// 		break;
						// 	case 2:
						// 		priceDetail[id] = preSelNum > 1 ? priceDetail[id] : priceDetail[id] + 3500;
						// 		break;
						// }
						This._ajaxModifyOrder(id, '"toiletNum":' + data.id);
						yzOrderDtl[id].toiletNum = data.id;
						// This._getPrice();//计算新价格并写入
						console.log(priceDetail);
					}
				});
			},
			//硬装下拉阳台绑定事件
			_eventBindYZBalconySlide: function(el, id, initId) {
				var This = this;
				slideOption.add(el, {
					title: "选择阳台 - 快翻套餐",
					data: [
						{
							id: 1,
							txt: "一个阳台"
						},
						{
							id: 2,
							txt: "两个阳台"
						}
						// ,
						// {
						// 	id: 3,
						// 	txt: "三个阳台"
						// }
					],
					choose: true, // 是否是选项列表
					// 设置初始选项 不设置为null
					initOption: function(el, datas) {
						// $(el).find('input').val(datas[0].txt);
						$(el).find('input').attr("data-id", datas[0].id);
					},
					callback: function(data) {
						$(el).find('input').val(data.txt);
						$(el).find('input').attr("data-id", data.id);
						var preSelNum = yzOrderDtl[id].balconyNum; //上一次选择的数量
						// switch(data.id) {
						// 	case 1:
						// 		priceDetail[id] = preSelNum > 1 ? priceDetail[id] - 1000 : priceDetail[id];
						// 		break;
						// 	case 2:
						// 		priceDetail[id] = preSelNum > 1 ? priceDetail[id] : priceDetail[id] + 1000;
						// 		break;
						// }
						This._ajaxModifyOrder(id, '"balconyNum":' + data.id);
						yzOrderDtl[id].balconyNum = data.id;
						// This._getPrice();//计算新价格并写入
						console.log(priceDetail);
					}
				});
			},
			_eventBindKFSlide: function(el, id, initId) {
				var This = this;
				slideOption.add(el, {
					title: "选择居室 - 快翻套餐",
					data: [
						{
							id: 1,
							txt: "一居室",
							price: 3600
						},
						{
							id: 2,
							txt: "两居室",
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
						// $(el).find('input').val(datas[0].txt);
						$(el).find('input').attr("data-id", datas[0].id);
					},
					callback: function(data) {
						$(el).find('input').val(data.txt);
						$(el).find('input').attr("data-id", data.id);
						console.log(data);
						if (data.id <= 3) {
							This._ajaxModifyOrder(id, '"layout":' + data.id);
						} else {
							This._ajaxModifyOrder(id, '"nums":1');
						}
						// switch(data.id) {
						// 	case 1:
						// 		priceDetail[id] = 3600;
						// 		break;
						// 	case 2:
						// 		priceDetail[id] = 6200;
						// 		break;
						// 	case 3:
						// 		priceDetail[id] = 8500;
						// 		break;
						// 	case 4:
						// 		priceDetail[id] = 1999;
						// 		break;	
						// }
						// This._getPrice();//计算新价格并写入
						console.log(priceDetail);
					}
				});
			},
			_eventBindRZSlide: function(el, id, initId) {
				var This = this;
				slideOption.add(el, {
					title: "选择居室 - 软装套餐",
					data: [
						{
							id: 1,
							txt: "一居室",
							price: 1300
						},
						{
							id: 2,
							txt: "两居室",
							price: 2200
						},
						{
							id: 3,
							txt: "三居室",
							price: 2900
						}
					],
					choose: true, // 是否是选项列表
					// 设置初始选项 不设置为null
					initOption: function(el, datas) {
						// $(el).find('input').val(datas[0].txt);
						$(el).find('input').attr("data-id", datas[0].id);
					},
					callback: function(data) {
						$(el).find('input').val(data.txt);
						$(el).find('input').attr("data-id", data.id);
						console.log(data);
						This._ajaxModifyOrder(id, '"layout":' + data.id);
						// switch(data.id) {
						// 	case 1:
						// 		priceDetail[id] = 1300;
						// 		break;
						// 	case 2:
						// 		priceDetail[id] = 2200;
						// 		break;
						// 	case 3:
						// 		priceDetail[id] = 2900;
						// 		break;
						// }
						// This._getPrice();//计算新价格并写入
						console.log(priceDetail);
					}
				});
			},
			_eventBindJJSlide: function(el, id, initId) {
				var This = this;
				slideOption.add(el, {
					title: "选择居室 - 家具套餐",
					data: [
						{
							id: 1,
							txt: "一居室",
							price: 3000
						},
						{
							id: 2,
							txt: "两居室",
							price: 4800
						},
						{
							id: 3,
							txt: "三居室",
							price: 6500
						}
					],
					choose: true, // 是否是选项列表
					// 设置初始选项 不设置为null
					initOption: function(el, datas) {
						// $(el).find('input').val(datas[0].txt);
						$(el).find('input').attr("data-id", datas[0].id);
					},
					callback: function(data) {
						$(el).find('input').val(data.txt);
						$(el).find('input').attr("data-id", data.id);
						console.log(data);

						This._ajaxModifyOrder(id, '"layout":' + data.id);
						// switch(data.id) {
						// 	case 1:
						// 		priceDetail[id] = 3000;
						// 		break;
						// 	case 2:
						// 		priceDetail[id] = 4800;
						// 		break;
						// 	case 3:
						// 		priceDetail[id] = 6500;
						// 		break;
						// }
						// This._getPrice();//计算新价格并写入
						console.log(priceDetail);
					}
				});
			},
			_eventBindJDSlide: function(el, id, initId) {
				var This = this;
				slideOption.add(el, {
					title: "选择居室 - 家电套餐",
					data: [
						{
							id: 1,
							txt: "一居室",
							price: 4000
						},
						{
							id: 2,
							txt: "两居室",
							price: 5500
						},
						{
							id: 3,
							txt: "三居室",
							price: 7000
						}
					],
					choose: true, // 是否是选项列表
					// 设置初始选项 不设置为null
					initOption: function(el, datas) {
						// $(el).find('input').val(datas[0].txt);
						$(el).find('input').attr("data-id", datas[0].id);
					},
					callback: function(data) {
						$(el).find('input').val(data.txt);
						$(el).find('input').attr("data-id", data.id);
						console.log(data);
						This._ajaxModifyOrder(id, '"layout":' + data.id);

						// switch(data.id) {
						// 	case 1:
						// 		priceDetail[id] = 4000;
						// 		break;
						// 	case 2:
						// 		priceDetail[id] = 5500;
						// 		break;
						// 	case 3:
						// 		priceDetail[id] = 7000;
						// 		break;
						// }
						// This._getPrice();//计算新价格并写入
						console.log(priceDetail);
					}
				});
			},
			_ajaxModifyOrder: function(oid, param) {
				$.ajax({
					url: baseUrl + "orderCtrl/updateOrders.htm",
					data: {"ordersStr": '{"orders": [{"orderId":' + parseInt(oid) + ',' + param + '}]}'}, 
					//{"ordersStr": '{"orders": [{"productId": 1, ' + params + '}]}'},
					success: function(res) {
						if (res.ret == 1) {
							// 修改成功
							var price = 0;
							var orders = res.orderInfos;
							for (var i = 0, n = orders.length; i < n; i++) {
								if (orders[i].orderId == oid) {
									price = orders[i].total;
									break;
								}
							}
							$('#price_' + oid).html(price);
							priceDetail[oid] = price;
						}
						// alert(JSON.stringify(res));
					},
					error: function(err) {
						console.log(err);
					}
				});
			},
			_ajaxCancelOrder: function(id) {
				console.log(id);
				var This = this;
				$.ajax({
					url: baseUrl + "orderCtrl/cancelOrder.htm?orderId=" + id,
					dataType: "json",
					success: function(res) {
						console.log(res);
						(res.ret == 1) && This._animationOrderHide(id);
					},
					error: function(err) {
						console.log(err);
					}
				});
			},
			_animationOrderHide: function(id) {
				console.log($('#orderCnt_' + id));
				var orderCnt = $('#orderCnt_' + id);
				var height = orderCnt.height();
				orderCnt.addClass("hide1");
				setTimeout(function() {
					// orderCnt.attr("marginTop", "-" + (height + 10) + "px");
					orderCnt.css("marginTop", -(height + 9) + "px");
					// orderCnt.css("WebkitTransform", "translateX(-640px) translateY(-" + (height + 9) + "px)");
					// orderCnt.css("height", 0);
				}, 400);
				dialog.add("已删除编号为" + id + "的订单");
				// orderCnt.css({"BorderBottom": "2px solid #d1d1d1", "opacity": 0});
			},
			getOrder: function(type) {
				var This = this;
				payState = type;
				selectedOrder = "";
				priceEl.html("￥0");
				if (type > 2) {
					$('.order-bar').hide();
				} else {
					$('.order-bar').show();
				}
				topNav.eq(type - 1).addClass('on').siblings().removeClass('on');
				$.ajax({
					// 未完成订单
					url: baseUrl + "orderCtrl/getOrders.htm?type=" + type,
					dataType: "json",
					success: function(res) {
						// alert("ret:" + JSON.stringify(res));
						var orderId = "";
						if (res.ret == 1) {
							// 获取订单信息成功
							var orderList = res.orderInfos;
							var str = "";
							// alert(typeof orderList);
							try	{
								if (!!orderList.length) {
									[].forEach.call(orderList, function(order) {
										priceDetail[order.orderId] = order.total;
										if (type != 4) {
											// ============================
											if (order.state == 0) {
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
														<div class="order kuaifan-order" id="orderCnt_' + order.orderId + '">\
															<div class="top-bottom">订单编号：' + order.orderId + '</div>\
															<div class="cnt">\
																<div class="sub-cnt">\
																	<div class="name">\
																		<i class="iconfont choose-cbtn" data-type="kuaifan-order" data-id="' + order.orderId + '">&#xe60b;</i>\
																		<span data-id="' + order.orderId + '">快翻套餐</span>\
																		<a class="delete" data-id="' + order.orderId + '"><i class="iconfont">&#xe60b;</i>删除</a>\
																	</div>\
																	<div class="choose">\
																		<div class="form-set kf-house" id="order_' + order.orderId + '">\
																			<p class="droplist item">\
																				<em></em>\
																				<input type="text" value="' + inputVal + '" readonly="readonly" data-id="' + dataid + '">\
																				<span><i></i></span>\
																			</p>\
																		</div>\
																	</div>\
																</div>\
															</div>\
															<div class="top-bottom">\
																<span class="date-time">' + Tools.timeFormat(order.createTime) + '</span>\
																<span class="price">￥<i id="price_' + order.orderId + '">' + order.total + '</i></span>\
															</div>\
														</div>\
													';
												} else if (order.productType == 2) {
													// 硬装订单
													yzOrderDtl[order.orderId] = {};
													yzOrderDtl[order.orderId].balconyNum = order.balconyNum;
													yzOrderDtl[order.orderId].toiletNum = order.toiletNum;
													var acreage = order.acreage
														, balconyNum = order.balconyNum
														, toiletNum = order.toiletNum
														, productStyle = order.productStyle
														, balconyNumTxt = ""
														, toiletNumTxt = "";
													switch(balconyNum) {
														case 1: 
															balconyNumTxt = "一个阳台";
															break;
														case 2:
															balconyNumTxt = "两个阳台";
															break;
													}
													switch(toiletNum) {
														case 1: 
															toiletNumTxt = "一个卫生间";
															break;
														case 2:
															toiletNumTxt = "两个卫生间";
															break;
													}
													
													str += '\
														<div class="order yingzhuang-order" id="orderCnt_' + order.orderId + '">\
															<div class="top-bottom">订单编号：' + order.orderId + '</div>\
															<div class="cnt">\
																<div class="sub-cnt">\
																	<div class="name">\
																		<i class="iconfont choose-cbtn" data-type="yingzhuang-order" data-id="' + order.orderId + '">&#xe60b;</i>\
																		<span data-id="' + order.orderId + '">硬装套餐</span>\
																		<a class="delete" data-id="' + order.orderId + '"><i class="iconfont">&#xe60b;</i>删除</a>\
																	</div>\
																	<div class="choose Horizontal">\
																		<div class="form-set square yz-square">\
																			<p class="item">\
																				<em></em>\
																				<input type="text" readonly="readonly" data-id="1" value="100平米">\
																			</p>\
																		</div>\
																		<div class="form-set path-room yz-bathroom" id="toilet_' + order.orderId + '">\
																			<p class="droplist item">\
																				<em></em>\
																				<input type="text" value="' + toiletNumTxt + '" readonly="readonly" data-id="' + toiletNum + '">\
																				<span><i></i></span>\
																			</p>\
																		</div>\
																		<div class="form-set sun-plateform yz-platform" id="balcony_' + order.orderId + '">\
																			<p class="droplist item">\
																				<em></em>\
																				<input type="text" value="' + balconyNumTxt + '" readonly="readonly" data-id="' + balconyNum + '">\
																				<span><i></i></span>\
																			</p>\
																		</div>\
																	</div>\
																</div>\
															</div>\
															<div class="top-bottom">\
																<span>' + Tools.timeFormat(order.createTime) + '</span>\
																<span class="price">￥<i id="price_' + order.orderId + '">' + order.total + '</i></span>\
															</div>\
														</div>\
													';
												} else if (order.productType == 3) {
													// 软装
													var layout = order.layout
														, inputVal = ""
														, dataid = null;
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
													str += '\
														<div class="order kuaifan-order" id="orderCnt_' + order.orderId + '">\
															<div class="top-bottom">订单编号：' + order.orderId + '</div>\
															<div class="cnt">\
																<div class="sub-cnt">\
																	<div class="name">\
																		<i class="iconfont choose-cbtn" data-type="kuaifan-order" data-id="' + order.orderId + '">&#xe60b;</i>\
																		<span data-id="' + order.orderId + '">软装套餐</span>\
																		<a class="delete" data-id="' + order.orderId + '"><i class="iconfont">&#xe60b;</i>删除</a>\
																	</div>\
																	<div class="choose">\
																		<div class="form-set kf-house" id="order_' + order.orderId + '">\
																			<p class="droplist item">\
																				<em></em>\
																				<input type="text" value="' + inputVal + '" readonly="readonly" data-id="' + dataid + '">\
																				<span><i></i></span>\
																			</p>\
																		</div>\
																	</div>\
																</div>\
															</div>\
															<div class="top-bottom">\
																<span class="date-time">' + Tools.timeFormat(order.createTime) + '</span>\
																<span class="price">￥<i id="price_' + order.orderId + '">' + order.total + '</i></span>\
															</div>\
														</div>\
													';
												} else if (order.productType == 4) {
													// 家具套餐
													var layout = order.layout
														, inputVal = ""
														, dataid = null;
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
													str += '\
														<div class="order kuaifan-order" id="orderCnt_' + order.orderId + '">\
															<div class="top-bottom">订单编号：' + order.orderId + '</div>\
															<div class="cnt">\
																<div class="sub-cnt">\
																	<div class="name">\
																		<i class="iconfont choose-cbtn" data-type="kuaifan-order" data-id="' + order.orderId + '">&#xe60b;</i>\
																		<span data-id="' + order.orderId + '">家具套餐</span>\
																		<a class="delete" data-id="' + order.orderId + '"><i class="iconfont">&#xe60b;</i>删除</a>\
																	</div>\
																	<div class="choose">\
																		<div class="form-set kf-house" id="order_' + order.orderId + '">\
																			<p class="droplist item">\
																				<em></em>\
																				<input type="text" value="' + inputVal + '" readonly="readonly" data-id="' + dataid + '">\
																				<span><i></i></span>\
																			</p>\
																		</div>\
																	</div>\
																</div>\
															</div>\
															<div class="top-bottom">\
																<span class="date-time">' + Tools.timeFormat(order.createTime) + '</span>\
																<span class="price">￥<i id="price_' + order.orderId + '">' + order.total + '</i></span>\
															</div>\
														</div>\
													';
												} else if (order.productType == 5) {
													var layout = order.layout
														, inputVal = ""
														, dataid = null;
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
													str += '\
														<div class="order kuaifan-order" id="orderCnt_' + order.orderId + '">\
															<div class="top-bottom">订单编号：' + order.orderId + '</div>\
															<div class="cnt">\
																<div class="sub-cnt">\
																	<div class="name">\
																		<i class="iconfont choose-cbtn" data-type="kuaifan-order" data-id="' + order.orderId + '">&#xe60b;</i>\
																		<span data-id="' + order.orderId + '">家电套餐</span>\
																		<a class="delete" data-id="' + order.orderId + '"><i class="iconfont">&#xe60b;</i>删除</a>\
																	</div>\
																	<div class="choose">\
																		<div class="form-set kf-house" id="order_' + order.orderId + '">\
																			<p class="droplist item">\
																				<em></em>\
																				<input type="text" value="' + inputVal + '" readonly="readonly" data-id="' + dataid + '">\
																				<span><i></i></span>\
																			</p>\
																		</div>\
																	</div>\
																</div>\
															</div>\
															<div class="top-bottom">\
																<span class="date-time">' + Tools.timeFormat(order.createTime) + '</span>\
																<span class="price">￥<i id="price_' + order.orderId + '">' + order.total + '</i></span>\
															</div>\
														</div>\
													';
												} else if (order.productType >= 6 && order.productType <= 11) {
													var proType = order.productType
														, inputVal = ""
														, dataid = null;
													switch(proType) {
														case 6: 
															inputVal = "地板";
															break;
														case 7:
															inputVal = "乳胶漆";
															break;
														case 8:
															inputVal = "壁纸";
															break;
														case 9: 
															inputVal = "瓷砖";
															break;
														case 10:
															inputVal = "厨卫天花";
															break;
														case 11:
															inputVal = "室内门";
													}
													str += '\
														<div class="order kuaifan-order" id="orderCnt_' + order.orderId + '">\
															<div class="top-bottom">订单编号：' + order.orderId + '</div>\
															<div class="cnt">\
																<div class="sub-cnt">\
																	<div class="name">\
																		<i class="iconfont choose-cbtn" data-type="kuaifan-order" data-id="' + order.orderId + '">&#xe60b;</i>\
																		<span data-id="' + order.orderId + '">' + order.productName + '</span>\
																		<a class="delete" data-id="' + order.orderId + '"><i class="iconfont">&#xe60b;</i>删除</a>\
																	</div>\
																	<div class="step-list">\
																		<div class="row">\
																			<span>' + inputVal + '-' + ((proType == 11) ? (order.nums + '樘') : (order.acreage + "平方米")) + '</span>\
																			<span class="price">￥' + order.total + '</span>\
																		</div>\
																	</div>\
																</div>\
															</div>\
															<div class="top-bottom">\
																<span class="date-time">' + Tools.timeFormat(order.createTime) + '</span>\
																<span class="price">￥<i id="price_' + order.orderId + '">' + order.total + '</i></span>\
															</div>\
														</div>\
													';
												}
											} else if (order.state == 1) {
												// 已付99 订单进行中
												if (order.productType == 1) {
													// 快翻订单
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
													str += '\
														<div class="order kuaifan-order" id="orderCnt_' + order.orderId + '">\
															<div class="top-bottom">订单编号：' + order.orderId + '</div>\
															<div class="cnt">\
																<div class="sub-cnt">\
																	<div class="name">\
																		<i class="iconfont choose-cbtn" data-type="kuaifan-order" data-protype="kuaifan" data-id="' + order.orderId + '">&#xe60b;</i>\
																		<span data-id="' + order.orderId + '">快翻套餐</span>\
																	</div>\
																	<div class="choose">\
																		<div class="form-set kf-house" id="order_' + order.orderId + '">\
																			<p class="droplist item">\
																				<em></em>\
																				<input type="text" value="' + inputVal + '" readonly="readonly" data-id="' + dataid + '">\
																			</p>\
																		</div>\
																	</div>\
																</div>\
															</div>\
															<div class="top-bottom">\
																<span class="date-time">' + Tools.timeFormat(order.createTime) + '</span>\
																<span class="price">￥<i id="price_' + order.orderId + '">' + order.total + '</i></span>\
															</div>\
														</div>\
													';
												} else if (order.productType == 2) {
													var acreage = order.acreage
														, balconyNum = order.balconyNum
														, toiletNum = order.toiletNum
														, productStyle = order.productStyle
														, balconyNumTxt = ""
														, toiletNumTxt = "";
													switch(balconyNum) {
														case 1: 
															balconyNumTxt = "一个阳台";
															break;
														case 2:
															balconyNumTxt = "两个阳台";
															break;
													}
													switch(toiletNum) {
														case 1: 
															toiletNumTxt = "一个卫生间";
															break;
														case 2:
															toiletNumTxt = "两个卫生间";
															break;
													}
													var stepStr = ""
														, payStepId = "";//可以支付的stepid
													[].forEach.call(order.stepInfos, function(step) {
														(step.state == 5) && (payStepId = step.stepId);
														stepStr += '\
															<div class="row">\
																<i class="iconfont choose-cbtn ' + stepCal(step.state).on + '">&#xe60b;</i>\
																<span>' + step.stepName + stepCal(step.state).txt + '</span>\
																<span class="price">￥' + step.stepTotalCost + '</span>\
															</div>\
														';
													});
													str += '\
														<div class="order yingzhuang-order" id="orderCnt_' + order.orderId + '" data-paystep="' + payStepId + '">\
															<div class="top-bottom">订单编号：' + order.orderId + '</div>\
															<div class="cnt">\
																<div class="sub-cnt">\
																	<div class="name">\
																		<i class="iconfont choose-cbtn" data-type="yingzhuang-order" data-protype="yingzhuang" data-id="' + order.orderId + '">&#xe60b;</i>\
																		<span data-id="' + order.orderId + '">硬装套餐</span>\
																	</div>\
																	<div class="choose Horizontal">\
																		<div class="form-set square yz-square">\
																			<p class="item">\
																				<em></em>\
																				<input type="text" placeholder="100平米" readonly="readonly" data-id="1" value="100平米">\
																			</p>\
																		</div>\
																		<div class="form-set path-room yz-bathroom" id="toilet_' + order.orderId + '">\
																			<p class="droplist item">\
																				<em></em>\
																				<input type="text" value="' + toiletNumTxt + '" readonly="readonly" data-id="' + toiletNum + '">\
																			</p>\
																		</div>\
																		<div class="form-set sun-plateform yz-platform" id="balcony_' + order.orderId + '">\
																			<p class="droplist item">\
																				<em></em>\
																				<input type="text" value="' + balconyNumTxt + '" readonly="readonly" data-id="' + balconyNum + '">\
																			</p>\
																		</div>\
																	</div>\
																	<div class="step-list">' + stepStr + '\
																	</div>\
																</div>\
															</div>\
															<div class="top-bottom">\
																<span>' + Tools.timeFormat(order.createTime) + '</span>\
																<span class="price">￥<i id="price_' + order.orderId + '">' + order.total + '</i></span>\
															</div>\
														</div>\
													';
												} else if (order.productType == 3) {
													// 软装
													var layout = order.layout
														, inputVal = ""
														, dataid = null;
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
													str += '\
														<div class="order kuaifan-order" id="orderCnt_' + order.orderId + '">\
															<div class="top-bottom">订单编号：' + order.orderId + '</div>\
															<div class="cnt">\
																<div class="sub-cnt">\
																	<div class="name">\
																		<i class="iconfont choose-cbtn" data-type="kuaifan-order" data-id="' + order.orderId + '">&#xe60b;</i>\
																		<span data-id="' + order.orderId + '">软装套餐</span>\
																		<a class="delete" data-id="' + order.orderId + '"><i class="iconfont">&#xe60b;</i>删除</a>\
																	</div>\
																	<div class="choose">\
																		<div class="form-set kf-house" id="order_' + order.orderId + '">\
																			<p class="droplist item">\
																				<em></em>\
																				<input type="text" value="' + inputVal + '" readonly="readonly" data-id="' + dataid + '">\
																			</p>\
																		</div>\
																	</div>\
																</div>\
															</div>\
															<div class="top-bottom">\
																<span class="date-time">' + Tools.timeFormat(order.createTime) + '</span>\
																<span class="price">￥<i id="price_' + order.orderId + '">' + order.total + '</i></span>\
															</div>\
														</div>\
													';
												} else if (order.productType == 4) {
													// 家具套餐
													var layout = order.layout
														, inputVal = ""
														, dataid = null;
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
													str += '\
														<div class="order kuaifan-order" id="orderCnt_' + order.orderId + '">\
															<div class="top-bottom">订单编号：' + order.orderId + '</div>\
															<div class="cnt">\
																<div class="sub-cnt">\
																	<div class="name">\
																		<i class="iconfont choose-cbtn" data-type="kuaifan-order" data-id="' + order.orderId + '">&#xe60b;</i>\
																		<span data-id="' + order.orderId + '">家具套餐</span>\
																		<a class="delete" data-id="' + order.orderId + '"><i class="iconfont">&#xe60b;</i>删除</a>\
																	</div>\
																	<div class="choose">\
																		<div class="form-set kf-house" id="order_' + order.orderId + '">\
																			<p class="droplist item">\
																				<em></em>\
																				<input type="text" value="' + inputVal + '" readonly="readonly" data-id="' + dataid + '">\
																			</p>\
																		</div>\
																	</div>\
																</div>\
															</div>\
															<div class="top-bottom">\
																<span class="date-time">' + Tools.timeFormat(order.createTime) + '</span>\
																<span class="price">￥<i id="price_' + order.orderId + '">' + order.total + '</i></span>\
															</div>\
														</div>\
													';
												} else if (order.productType == 5) {
													var layout = order.layout
														, inputVal = ""
														, dataid = null;
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
													str += '\
														<div class="order kuaifan-order" id="orderCnt_' + order.orderId + '">\
															<div class="top-bottom">订单编号：' + order.orderId + '</div>\
															<div class="cnt">\
																<div class="sub-cnt">\
																	<div class="name">\
																		<i class="iconfont choose-cbtn" data-type="kuaifan-order" data-id="' + order.orderId + '">&#xe60b;</i>\
																		<span data-id="' + order.orderId + '">家电套餐</span>\
																		<a class="delete" data-id="' + order.orderId + '"><i class="iconfont">&#xe60b;</i>删除</a>\
																	</div>\
																	<div class="choose">\
																		<div class="form-set kf-house" id="order_' + order.orderId + '">\
																			<p class="droplist item">\
																				<em></em>\
																				<input type="text" value="' + inputVal + '" readonly="readonly" data-id="' + dataid + '">\
																			</p>\
																		</div>\
																	</div>\
																</div>\
															</div>\
															<div class="top-bottom">\
																<span class="date-time">' + Tools.timeFormat(order.createTime) + '</span>\
																<span class="price">￥<i id="price_' + order.orderId + '">' + order.total + '</i></span>\
															</div>\
														</div>\
													';
												} else if (order.productType >= 6 && order.productType <= 11) {
													var proType = order.productType
														, inputVal = ""
														, dataid = null;
													switch(proType) {
														case 6: 
															inputVal = "地板";
															break;
														case 7:
															inputVal = "乳胶漆";
															break;
														case 8:
															inputVal = "壁纸";
															break;
														case 9: 
															inputVal = "瓷砖";
															break;
														case 10:
															inputVal = "厨卫天花";
															break;
														case 11:
															inputVal = "室内门";
													}
													str += '\
														<div class="order kuaifan-order" id="orderCnt_' + order.orderId + '">\
															<div class="top-bottom">订单编号：' + order.orderId + '</div>\
															<div class="cnt">\
																<div class="sub-cnt">\
																	<div class="name">\
																		<i class="iconfont choose-cbtn" data-type="kuaifan-order" data-id="' + order.orderId + '">&#xe60b;</i>\
																		<span data-id="' + order.orderId + '">' + order.productName + '</span>\
																	</div>\
																	<div class="step-list">\
																		<div class="row">\
																			<span>' + inputVal + '-' + ((proType == 11) ? (order.nums + '樘') : (order.acreage + "平方米")) + '</span>\
																			<span class="price">￥' + order.total + '</span>\
																		</div>\
																	</div>\
																</div>\
															</div>\
															<div class="top-bottom">\
																<span class="date-time">' + Tools.timeFormat(order.createTime) + '</span>\
																<span class="price">￥<i id="price_' + order.orderId + '">' + order.total + '</i></span>\
															</div>\
														</div>\
													';
												}
											} else if (order.state == 2) {
												// 已完工
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
														<div class="order kuaifan-order" id="orderCnt_' + order.orderId + '">\
															<div class="top-bottom">订单编号：' + order.orderId + '</div>\
															<div class="cnt">\
																<div class="sub-cnt">\
																	<div class="name">\
																		<span data-id="' + order.orderId + '">快翻套餐</span>\
																		<a class="delete" data-id="' + order.orderId + '"><i class="iconfont">&#xe60b;</i>删除</a>\
																	</div>\
																	<div class="choose">\
																		<div class="form-set kf-house" id="order_' + order.orderId + '">\
																			<p class="droplist item">\
																				<em></em>\
																				<input type="text" value="' + inputVal + '" readonly="readonly" data-id="' + dataid + '">\
																			</p>\
																		</div>\
																	</div>\
																</div>\
															</div>\
															<div class="top-bottom">\
																<span class="date-time">' + Tools.timeFormat(order.createTime) + '</span>\
																<span class="price">已完工</span>\
															</div>\
														</div>\
													';
												} else if (order.productType == 2) {
													// 硬装订单
													yzOrderDtl[order.orderId] = {};
													yzOrderDtl[order.orderId].balconyNum = order.balconyNum;
													yzOrderDtl[order.orderId].toiletNum = order.toiletNum;
													var acreage = order.acreage
														, balconyNum = order.balconyNum
														, toiletNum = order.toiletNum
														, productStyle = order.productStyle
														, balconyNumTxt = ""
														, toiletNumTxt = "";
													switch(balconyNum) {
														case 1: 
															balconyNumTxt = "一个阳台";
															break;
														case 2:
															balconyNumTxt = "两个阳台";
															break;
													}
													switch(toiletNum) {
														case 1: 
															toiletNumTxt = "一个卫生间";
															break;
														case 2:
															toiletNumTxt = "两个卫生间";
															break;
													}
													
													str += '\
														<div class="order yingzhuang-order" id="orderCnt_' + order.orderId + '">\
															<div class="top-bottom">订单编号：' + order.orderId + '</div>\
															<div class="cnt">\
																<div class="sub-cnt">\
																	<div class="name">\
																		<span data-id="' + order.orderId + '">硬装套餐</span>\
																		<a class="delete" data-id="' + order.orderId + '"><i class="iconfont">&#xe60b;</i>删除</a>\
																	</div>\
																	<div class="choose Horizontal">\
																		<div class="form-set square yz-square">\
																			<p class="item">\
																				<em></em>\
																				<input type="text" placeholder="100平米" readonly="readonly" data-id="1" value="100平米">\
																			</p>\
																		</div>\
																		<div class="form-set path-room yz-bathroom" id="toilet_' + order.orderId + '">\
																			<p class="droplist item">\
																				<em></em>\
																				<input type="text" value="' + toiletNumTxt + '" readonly="readonly" data-id="' + toiletNum + '">\
																			</p>\
																		</div>\
																		<div class="form-set sun-plateform yz-platform" id="balcony_' + order.orderId + '">\
																			<p class="droplist item">\
																				<em></em>\
																				<input type="text" value="' + balconyNumTxt + '" readonly="readonly" data-id="' + balconyNum + '">\
																				<span><i></i></span>\
																			</p>\
																		</div>\
																	</div>\
																</div>\
															</div>\
															<div class="top-bottom">\
																<span>' + Tools.timeFormat(order.createTime) + '</span>\
																<span class="price">已完工</span>\
															</div>\
														</div>\
													';
												} else if (order.productType == 3) {
													// 软装
													var layout = order.layout
														, inputVal = ""
														, dataid = null;
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
													str += '\
														<div class="order kuaifan-order" id="orderCnt_' + order.orderId + '">\
															<div class="top-bottom">订单编号：' + order.orderId + '</div>\
															<div class="cnt">\
																<div class="sub-cnt">\
																	<div class="name">\
																		<span data-id="' + order.orderId + '">软装套餐</span>\
																		<a class="delete" data-id="' + order.orderId + '"><i class="iconfont">&#xe60b;</i>删除</a>\
																	</div>\
																	<div class="choose">\
																		<div class="form-set kf-house" id="order_' + order.orderId + '">\
																			<p class="droplist item">\
																				<em></em>\
																				<input type="text" value="' + inputVal + '" readonly="readonly" data-id="' + dataid + '">\
																			</p>\
																		</div>\
																	</div>\
																</div>\
															</div>\
															<div class="top-bottom">\
																<span class="date-time">' + Tools.timeFormat(order.createTime) + '</span>\
																<span class="price">已完工</span>\
															</div>\
														</div>\
													';
												} else if (order.productType == 4) {
													// 家具套餐
													var layout = order.layout
														, inputVal = ""
														, dataid = null;
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
													str += '\
														<div class="order kuaifan-order" id="orderCnt_' + order.orderId + '">\
															<div class="top-bottom">订单编号：' + order.orderId + '</div>\
															<div class="cnt">\
																<div class="sub-cnt">\
																	<div class="name">\
																		<span data-id="' + order.orderId + '">家具套餐</span>\
																		<a class="delete" data-id="' + order.orderId + '"><i class="iconfont">&#xe60b;</i>删除</a>\
																	</div>\
																	<div class="choose">\
																		<div class="form-set kf-house" id="order_' + order.orderId + '">\
																			<p class="droplist item">\
																				<em></em>\
																				<input type="text" value="' + inputVal + '" readonly="readonly" data-id="' + dataid + '">\
																			</p>\
																		</div>\
																	</div>\
																</div>\
															</div>\
															<div class="top-bottom">\
																<span class="date-time">' + Tools.timeFormat(order.createTime) + '</span>\
																<span class="price">已完工</span>\
															</div>\
														</div>\
													';
												} else if (order.productType == 5) {
													var layout = order.layout
														, inputVal = ""
														, dataid = null;
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
													str += '\
														<div class="order kuaifan-order" id="orderCnt_' + order.orderId + '">\
															<div class="top-bottom">订单编号：' + order.orderId + '</div>\
															<div class="cnt">\
																<div class="sub-cnt">\
																	<div class="name">\
																		<span data-id="' + order.orderId + '">家电套餐</span>\
																		<a class="delete" data-id="' + order.orderId + '"><i class="iconfont">&#xe60b;</i>删除</a>\
																	</div>\
																	<div class="choose">\
																		<div class="form-set kf-house" id="order_' + order.orderId + '">\
																			<p class="droplist item">\
																				<em></em>\
																				<input type="text" value="' + inputVal + '" readonly="readonly" data-id="' + dataid + '">\
																			</p>\
																		</div>\
																	</div>\
																</div>\
															</div>\
															<div class="top-bottom">\
																<span class="date-time">' + Tools.timeFormat(order.createTime) + '</span>\
																<span class="price">已完工</span>\
															</div>\
														</div>\
													';
												} else if (order.productType >= 6 && order.productType <= 11) {
													var proType = order.productType
														, inputVal = ""
														, dataid = null;
													switch(proType) {
														case 6: 
															inputVal = "地板";
															break;
														case 7:
															inputVal = "乳胶漆";
															break;
														case 8:
															inputVal = "壁纸";
															break;
														case 9: 
															inputVal = "瓷砖";
															break;
														case 10:
															inputVal = "厨卫天花";
															break;
														case 11:
															inputVal = "室内门";
													}
													str += '\
														<div class="order kuaifan-order" id="orderCnt_' + order.orderId + '">\
															<div class="top-bottom">订单编号：' + order.orderId + '</div>\
															<div class="cnt">\
																<div class="sub-cnt">\
																	<div class="name">\
																		<span data-id="' + order.orderId + '">' + order.productName + '</span>\
																	</div>\
																	<div class="step-list">\
																		<div class="row">\
																			<span>' + inputVal + '-' + ((proType == 11) ? (order.nums + '樘') : (order.acreage + "平方米")) + '</span>\
																			<span class="price">￥' + order.total + '</span>\
																		</div>\
																	</div>\
																</div>\
															</div>\
															<div class="top-bottom">\
																<span class="date-time">' + Tools.timeFormat(order.createTime) + '</span>\
																<span class="price">已完工</span>\
															</div>\
														</div>\
													';
												}
											}
										} else if (type == 4) {
											// 历史订单
											var orderStep = "";
											if (order.state == 0) {
												orderStep = "未支付";
											} else if (order.state == 1) {
												orderStep = "开工中";
											} else if (order.state == 2) {
												orderStep = "已完工";
											}
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
													<div class="order kuaifan-order" id="orderCnt_' + order.orderId + '">\
														<div class="top-bottom">订单编号：' + order.orderId + '</div>\
														<div class="cnt">\
															<div class="sub-cnt">\
																<div class="name">\
																	<span data-id="' + order.orderId + '">快翻套餐</span>\
																</div>\
																<div class="choose">\
																	<div class="form-set kf-house" id="order_' + order.orderId + '">\
																		<p class="droplist item">\
																			<em></em>\
																			<input type="text" value="' + inputVal + '" readonly="readonly" data-id="' + dataid + '">\
																		</p>\
																	</div>\
																</div>\
															</div>\
														</div>\
														<div class="top-bottom">\
															<span class="date-time">' + Tools.timeFormat(order.createTime) + '</span>\
															<span class="price">' + orderStep + '</span>\
														</div>\
													</div>\
												';
											} else if (order.productType == 2) {
												// 硬装订单
												yzOrderDtl[order.orderId] = {};
												yzOrderDtl[order.orderId].balconyNum = order.balconyNum;
												yzOrderDtl[order.orderId].toiletNum = order.toiletNum;
												var acreage = order.acreage
													, balconyNum = order.balconyNum
													, toiletNum = order.toiletNum
													, productStyle = order.productStyle
													, balconyNumTxt = ""
													, toiletNumTxt = "";
												switch(balconyNum) {
													case 1: 
														balconyNumTxt = "一个阳台";
														break;
													case 2:
														balconyNumTxt = "两个阳台";
														break;
												}
												switch(toiletNum) {
													case 1: 
														toiletNumTxt = "一个卫生间";
														break;
													case 2:
														toiletNumTxt = "两个卫生间";
														break;
												}
												
												str += '\
													<div class="order yingzhuang-order" id="orderCnt_' + order.orderId + '">\
														<div class="top-bottom">订单编号：' + order.orderId + '</div>\
														<div class="cnt">\
															<div class="sub-cnt">\
																<div class="name">\
																	<span data-id="' + order.orderId + '">硬装套餐</span>\
																</div>\
																<div class="choose Horizontal">\
																	<div class="form-set square yz-square">\
																		<p class="item">\
																			<em></em>\
																			<input type="text" placeholder="100平米" readonly="readonly" data-id="1" value="100平米">\
																		</p>\
																	</div>\
																	<div class="form-set path-room yz-bathroom" id="toilet_' + order.orderId + '">\
																		<p class="droplist item">\
																			<em></em>\
																			<input type="text" value="' + toiletNumTxt + '" readonly="readonly" data-id="' + toiletNum + '">\
																		</p>\
																	</div>\
																	<div class="form-set sun-plateform yz-platform" id="balcony_' + order.orderId + '">\
																		<p class="droplist item">\
																			<em></em>\
																			<input type="text" value="' + balconyNumTxt + '" readonly="readonly" data-id="' + balconyNum + '">\
																		</p>\
																	</div>\
																</div>\
															</div>\
														</div>\
														<div class="top-bottom">\
															<span>' + Tools.timeFormat(order.createTime) + '</span>\
															<span class="price">' + orderStep + '</span>\
														</div>\
													</div>\
												';
											} else if (order.productType == 3) {
												// 软装
												var layout = order.layout
													, inputVal = ""
													, dataid = null;
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
												str += '\
													<div class="order kuaifan-order" id="orderCnt_' + order.orderId + '">\
														<div class="top-bottom">订单编号：' + order.orderId + '</div>\
														<div class="cnt">\
															<div class="sub-cnt">\
																<div class="name">\
																	<span data-id="' + order.orderId + '">软装套餐</span>\
																</div>\
																<div class="choose">\
																	<div class="form-set kf-house" id="order_' + order.orderId + '">\
																		<p class="droplist item">\
																			<em></em>\
																			<input type="text" value="' + inputVal + '" readonly="readonly" data-id="' + dataid + '">\
																		</p>\
																	</div>\
																</div>\
															</div>\
														</div>\
														<div class="top-bottom">\
															<span class="date-time">' + Tools.timeFormat(order.createTime) + '</span>\
															<span class="price">' + orderStep + '</span>\
														</div>\
													</div>\
												';
											} else if (order.productType == 4) {
												// 家具套餐
												var layout = order.layout
													, inputVal = ""
													, dataid = null;
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
												str += '\
													<div class="order kuaifan-order" id="orderCnt_' + order.orderId + '">\
														<div class="top-bottom">订单编号：' + order.orderId + '</div>\
														<div class="cnt">\
															<div class="sub-cnt">\
																<div class="name">\
																	<span data-id="' + order.orderId + '">家具套餐</span>\
																</div>\
																<div class="choose">\
																	<div class="form-set kf-house" id="order_' + order.orderId + '">\
																		<p class="droplist item">\
																			<em></em>\
																			<input type="text" value="' + inputVal + '" readonly="readonly" data-id="' + dataid + '">\
																		</p>\
																	</div>\
																</div>\
															</div>\
														</div>\
														<div class="top-bottom">\
															<span class="date-time">' + Tools.timeFormat(order.createTime) + '</span>\
															<span class="price">' + orderStep + '</span>\
														</div>\
													</div>\
												';
											} else if (order.productType == 5) {
												var layout = order.layout
													, inputVal = ""
													, dataid = null;
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
												str += '\
													<div class="order kuaifan-order" id="orderCnt_' + order.orderId + '">\
														<div class="top-bottom">订单编号：' + order.orderId + '</div>\
														<div class="cnt">\
															<div class="sub-cnt">\
																<div class="name">\
																	<span data-id="' + order.orderId + '">家电套餐</span>\
																</div>\
																<div class="choose">\
																	<div class="form-set kf-house" id="order_' + order.orderId + '">\
																		<p class="droplist item">\
																			<em></em>\
																			<input type="text" value="' + inputVal + '" readonly="readonly" data-id="' + dataid + '">\
																		</p>\
																	</div>\
																</div>\
															</div>\
														</div>\
														<div class="top-bottom">\
															<span class="date-time">' + Tools.timeFormat(order.createTime) + '</span>\
															<span class="price">' + orderStep + '</span>\
														</div>\
													</div>\
												';
											} else if (order.productType >= 6 && order.productType <= 11) {
												var proType = order.productType
													, inputVal = ""
													, dataid = null;
												switch(proType) {
													case 6: 
														inputVal = "地板";
														break;
													case 7:
														inputVal = "乳胶漆";
														break;
													case 8:
														inputVal = "壁纸";
														break;
													case 9: 
														inputVal = "瓷砖";
														break;
													case 10:
														inputVal = "厨卫天花";
														break;
													case 11:
														inputVal = "室内门";
												}
												str += '\
													<div class="order kuaifan-order" id="orderCnt_' + order.orderId + '">\
														<div class="top-bottom">订单编号：' + order.orderId + '</div>\
														<div class="cnt">\
															<div class="sub-cnt">\
																<div class="name">\
																	<span data-id="' + order.orderId + '">' + order.productName + '</span>\
																</div>\
																<div class="step-list">\
																	<div class="row">\
																		<span>' + inputVal + '-' + ((proType == 11) ? (order.nums + '樘') : (order.acreage + "平方米")) + '</span>\
																		<span class="price">￥' + order.total + '</span>\
																	</div>\
																</div>\
															</div>\
														</div>\
														<div class="top-bottom">\
															<span class="date-time">' + Tools.timeFormat(order.createTime) + '</span>\
															<span class="price">' + orderStep + '</span>\
														</div>\
													</div>\
												';
											}
										}
									});	
								} else {
									// 订单列表空
									str = '\
										<div class="order-empty">\
											<h3>这里还没有订单，您可以</h3>\
											<h4>查看其他状态订单，或者</h4>\
											<a href="http://www.s-jz.com/pub/Sbuild/pay/test/html/user" class="button-2">去首页看看</a>\
										</div>\
									';
								}
								console.log(priceDetail);
								console.log(yzOrderDtl);
								// This._getPrice();//计算新价格并写入
								This.EL_orderLis.html(str);
								if (!!orderList.length) {
									[].forEach.call(orderList, function(order) {
										if (order.state == 0) {
											var orderId = order.orderId
												, initId = 0
												, initId_t = 0
												, initId_b = 0;
											if (order.productType == 1) {
												initId = order.layout;
												This._eventBindKFSlide($('#order_' + orderId), orderId, initId);
											} else if (order.productType == 2) {
												initId_t = order.toiletNum;
												initId_b = order.balconyNum;
												This._eventBindYZToiletSlide($('#toilet_' + orderId), orderId, initId_t);
												This._eventBindYZBalconySlide($('#balcony_' + orderId), orderId, initId_b);
											} else if (order.productType == 3) {
												// 软装
												initId = order.layout;
												This._eventBindRZSlide($('#order_' + orderId), orderId, initId);
											} else if (order.productType == 4) {
												// 家具
												initId = order.layout;
												This._eventBindJJSlide($('#order_' + orderId), orderId, initId);
											} else if (order.productType == 5) {
												// 家电
												initId = order.layout;
												This._eventBindJDSlide($('#order_' + orderId), orderId, initId);
											}
											payButton.html('99元开工');
											priceTxtEl.html('需支付定金');
										} else if (order.state == 1) {
											payButton.html('结算');
											priceTxtEl.html('已支付定金');
											$('input').css("textAlign", "center");
										} else if (order.state == 2) {
											$('input').css("textAlign", "center");
										} else {
											
											$('input').css("textAlign", "center");
										}
									});
								}
								// 绑定删除
								$('.not-pay .delete').off('click').on('click', function() {
									var orderId = $(this).attr("data-id");
									This._ajaxCancelOrder(orderId);
									This._unChooseOrder(orderId); // 删除已选order中的当前order
								});
								// 绑定选中取消
								$('.sub-cnt .name .choose-cbtn').off('click').on('click', function() {
									var orderId = $(this).attr('data-id');
									$('.sub-cnt .name .choose-cbtn').removeClass("on");
									if ($(this).attr('data-protype') && $(this).attr('data-protype') == "yingzhuang") {
										productType = 2;
									} else {
										productType = 1;
									}
									if (!$(this).hasClass("on")) {
										selectedOrder = orderId;
										$(this).addClass("on");
										if (payState == 2) {
											priceEl.html("￥" + (parseFloat(priceDetail[selectedOrder]) - 99));
										} else if (payState == 1) {
											priceEl.html("￥" + parseFloat(priceDetail[selectedOrder]));
										}
										
									}
								});
								
							} catch(err) {
								alert(JSON.stringify(err));
								console.log(err);
							}
							
						} else if (res.ret == -1) {
							dialog.add("ret:-1 订单列表返回失败，请重试！");
						} else if (res.ret == 302) {
							// dialog.add("需登录！");
							checkUsr.doJump();
						}
					},
					error: function(res) {
						alert("err:" + JSON.stringify(res));
					}
				});
			},
			// js-jdk签证所需信息
			wxPay_qianzheng: function(payState, type) {
				var This = this;
				$.ajax({
					url: baseUrl + "wxsingctrl/sigin.htm?url=" + window.location.href,
					dataType: "json",
					success: function(res) {
						// alert(JSON.stringify(res));
						This.wxPay_getParams(payState, type);
					},
					error: function(res) {
						alert(JSON.stringify(res));
					}
				});
			},
			// 获取支付方法所需参数 payState 支付阶段（0:99/1:结算） type 产品类型(硬装/翻新)
			wxPay_getParams: function(payState, type) {
				// alert(payState);
				// alert(type);
				var This = this
					, params = ""
					, payState = payState || 1;
				if (payState == 1) {
					params = "&isFirst99=true";
				} else {
					if (type == 2) {
						// 硬装
						var paystep = $('#orderCnt_' + selectedOrder).attr('data-paystep');
						if (!!!paystep) {
							dialog.add("当前选中的订单无可支付项！");
							return;
						}
						params = "&stepId=" + paystep + "&isFirst99=false";
					} else {
						params = "";
					}
				}
				
				// alert(params);
				$.ajax({
					url: baseUrl + "pay/test/preparePay.htm?orderIds=" 
						+ selectedOrder 
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
												This.getOrder(2); // 跳到已支付
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
		};
		// bbb
try {
		shopCart.init();
} catch (e) {
	alert(JSON.stringify(e));
}
	});
});