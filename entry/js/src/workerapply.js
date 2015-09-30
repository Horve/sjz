// workerapply.js
define(['../core/core', './component/slideOptions'], function(core, slideOption) {
	core.onrender("workerapply", function(dom) {
		slideOption.add($('#wk-apply-formset'), {
			title: "选择工种",
			data: [
				{
					id: 1,
					txt: "水电工"
				},
				{
					id: 2,
					txt: "木工"
				},
				{
					id: 3,
					txt: "瓦工"
				},
				{
					id: 4,
					txt: "油工"
				},
				{
					id: 5,
					txt: "小工"
				}
			],
			choose: true, // 是否是选项列表
			// 设置初始选项 不设置为null
			initOption: function(el, datas) {
				$(el).find('input').val(datas[0].txt);
				$(el).find('input').attr("data-id", datas[0].id);
			},
			callback: function(data) {
				$('#wk-apply-formset input').val(data.txt);
				$('#wk-apply-formset input').attr("data-id", data.id);
			}
		});
		var workerApply = {
			DOM_DROP: $('#wk-apply-type'),
			DOM_DROPLIST: $('#wk-apply-formset .form-set-sub'),
			DOM_DROPITEM: $('#wk-apply-formset .form-set-sub .item-sub'),

			init: function() {
				var THIS = this;
				THIS.DOM_DROP.off("click").on("click", function() {
					THIS.DOM_DROPLIST.toggleClass("on");
				});
				THIS.DOM_DROPITEM.off("click").on("click", function() {
					var index = $(this).index();
					var txt = $(this).text();
					console.log(txt);
					THIS.DOM_DROP.find('input').val(txt);
					THIS.DOM_DROPLIST.removeClass("on");
				});


			}
		};
		workerApply.init();
	});
});