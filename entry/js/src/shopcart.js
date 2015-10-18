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
	});
});