// workerapply.js
define(['../core/core'], function(core) {
	core.onrender("workerapply", function(dom) {
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