define(['../core/core', './component/slideOptions'], function(core, slideOption) {
	core.onrender("quoteres", function(dom) {
		var Tools = core.Tools;

		slideOption.add($('.block.shuidian'), {
			title: "水电综合项目",
			data: [
				{
					id: 1,
					txt: "石膏板平顶"
				},
				{
					id: 2,
					txt: "防水处理"
				},
				{
					id: 3,
					txt: "吊顶"
				},
				{
					id: 4,
					txt: "PPR水管明装"
				},
				{
					id: 1,
					txt: "PPR水管暗装"
				},
				{
					id: 5,
					txt: "PVC管敷设暗线"
				},
				{
					id: 6,
					txt: "安装PVC分线盒"
				},
				{
					id: 2,
					txt: "安装PVC暗盒"
				},
				{
					id: 7,
					txt: "开补槽"
				},
				{
					id: 8,
					txt: "插座/开关安装"
				},
				{
					id: 9,
					txt: "配电线安装等"
				}
			],
			choose: false, // 是否是选项列表
			// 设置初始选项 不设置为null
			initOption: function(el, datas) {
				$(el).find('input').val(datas[0].txt);
				$(el).find('input').attr("data-id", datas[0].id);
			},
			callback: function(data) {
				$('#quote-new-house input').val(data.txt);
				$('#quote-new-house input').attr("data-id", data.id);
			}
		});
		slideOption.add($('.block.wagong'), {
			title: "瓦工项目",
			data: [
				{
					id: 1,
					txt: "地面水泥找平"
				},
				{
					id: 2,
					txt: "墙地面基层处理抹灰找平拉毛"
				},
				{
					id: 3,
					txt: "包立管"
				},
				{
					id: 4,
					txt: "贴地砖"
				},
				{
					id: 5,
					txt: "踢脚线"
				},
				{
					id: 6,
					txt: "贴墙砖"
				},
				{
					id: 7,
					txt: "墙地面勾缝"
				}
			],
			choose: false, // 是否是选项列表
			// 设置初始选项 不设置为null
			initOption: function(el, datas) {
				$(el).find('input').val(datas[0].txt);
				$(el).find('input').attr("data-id", datas[0].id);
			},
			callback: function(data) {
				$('#quote-new-house input').val(data.txt);
				$('#quote-new-house input').attr("data-id", data.id);
			}
		});
		slideOption.add($('.block.yougong'), {
			title: "油工项目",
			data: [
				{
					id: 1,
					txt: "墙顶面铲墙皮"
				},
				{
					id: 2,
					txt: "墙顶面批刮腻子打磨"
				},
				{
					id: 3,
					txt: "墙顶面石膏找平"
				},
				{
					id: 4,
					txt: "刷漆人工费"
				},
				{
					id: 5,
					txt: "墙顶面基层处理封墙锢"
				}
			],
			choose: false, // 是否是选项列表
			// 设置初始选项 不设置为null
			initOption: function(el, datas) {
				$(el).find('input').val(datas[0].txt);
				$(el).find('input').attr("data-id", datas[0].id);
			},
			callback: function(data) {
				$('#quote-new-house input').val(data.txt);
				$('#quote-new-house input').attr("data-id", data.id);
			}
		});
		slideOption.add($('.block.other'), {
			title: "其他项目",
			data: [
				{
					id: 1,
					txt: "垃圾清运费"
				},
				{
					id: 2,
					txt: "材料搬运费"
				},
				{
					id: 3,
					txt: "小五金安装"
				}
			],
			choose: false, // 是否是选项列表
			// 设置初始选项 不设置为null
			initOption: function(el, datas) {
				$(el).find('input').val(datas[0].txt);
				$(el).find('input').attr("data-id", datas[0].id);
			},
			callback: function(data) {
				$('#quote-new-house input').val(data.txt);
				$('#quote-new-house input').attr("data-id", data.id);
			}
		});

		var quoteres = {
			DOM_item_block: $('.block-item'),
			DOM_item_block_item: $('.block-item .block'),
			DOM_button: $('.quoteres .button-comm'),

			init: function() {
				var _this = this;
				Tools.scrollNum($('.quote-price .number'));
				var width_block = Tools.getCurrentStyle(this.DOM_item_block[0], "width");
				var width_item = Tools.getCurrentStyle(this.DOM_item_block_item[0], "width");
				this.DOM_item_block.css("height", width_block);
				this.DOM_item_block_item.css("height", width_item);
				setTimeout(function() {
					[].forEach.call(_this.DOM_item_block_item, function(item, index) {
						$(item).addClass("animation" + (index + 1));
					});
					_this.DOM_button.addClass("animation5");
				}, 0);
			}
		};
		quoteres.init();	
	});
	
});