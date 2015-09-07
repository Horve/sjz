define(['../core/core', './component/slideOptions'], function(zepto, slideOption) {
	slideOption.add($('#quote-new-house'), {
		title: "选择新房装修类型",
		data: [
			{
				id: 1,
				txt: "经济装 299/㎡"
			},
			{
				id: 2,
				txt: "品味装 399/㎡"
			}
		],
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

	// 旧房装修
	slideOption.add($('#quote-old-house'), {
		title: "选择旧房装修类型",
		data: [
			{
				id: 1,
				txt: "经济改造 99+299/㎡"
			},
			{
				id: 2,
				txt: "经济改造 99+399/㎡"
			}
		],
		// 设置初始选项 不设置为null
		initOption: function(el, datas) {
			$(el).find('input').val(datas[0].txt);
			$(el).find('input').attr("data-id", datas[0].id);
		},
		callback: function(data) {
			$('#quote-old-house input').val(data.txt);
			$('#quote-old-house input').attr("data-id", data.id);
		}
	});

	slideOption.add($('#h-shi'), {
		title: "房型-室",
		data: [
			{
				id: 1,
				txt: "1"
			},
			{
				id: 2,
				txt: "2"
			},
			{
				id: 3,
				txt: "3"
			}
		],
		// 设置初始选项 不设置为null
		initOption: function(el, datas) {
			$(el).find('input').val(datas[0].txt);
			$(el).find('input').attr("data-id", datas[0].id);
		},
		callback: function(data) {
			$('#h-shi input').val(data.txt);
			$('#h-shi input').attr("data-id", data.id);
		}
	});

	slideOption.add($('#h-ting'), {
		title: "房型-厅",
		data: [
			{
				id: 1,
				txt: "0"
			},
			{
				id: 2,
				txt: "1"
			},
			{
				id: 3,
				txt: "2"
			}
		],
		// 设置初始选项 不设置为null
		initOption: function(el, datas) {
			$(el).find('input').val(datas[0].txt);
			$(el).find('input').attr("data-id", datas[0].id);
		},
		callback: function(data) {
			$('#h-ting input').val(data.txt);
			$('#h-ting input').attr("data-id", data.id);
		}
	});

	slideOption.add($('#h-chu'), {
		title: "房型-厨",
		data: [
			{
				id: 1,
				txt: "0"
			},
			{
				id: 2,
				txt: "1"
			}
		],
		// 设置初始选项 不设置为null
		initOption: function(el, datas) {
			$(el).find('input').val(datas[0].txt);
			$(el).find('input').attr("data-id", datas[0].id);
		},
		callback: function(data) {
			$('#h-chu input').val(data.txt);
			$('#h-chu input').attr("data-id", data.id);
		}
	});

	slideOption.add($('#h-wei'), {
		title: "房型-卫",
		data: [
			{
				id: 1,
				txt: "0"
			},
			{
				id: 2,
				txt: "1"
			},
			{
				id: 3,
				txt: "2"
			}
		],
		// 设置初始选项 不设置为null
		initOption: function(el, datas) {
			$(el).find('input').val(datas[0].txt);
			$(el).find('input').attr("data-id", datas[0].id);
		},
		callback: function(data) {
			$('#h-wei input').val(data.txt);
			$('#h-wei input').attr("data-id", data.id);
		}
	});
});