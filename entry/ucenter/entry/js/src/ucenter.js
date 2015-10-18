define(['../core/core'], function(core) {
	core.onrender("ucenter-editinfo", function(dom) {
		var ruletxt = $('.rule-txt')
			, close = $('.close-rule')
			, cover = $('.cover')
			, ruleLink = $('.user-rule .rule-detail', dom);
		close.off('click').on('click', function() {
			ruletxt.addClass("hide");
			cover.hide();
		});
		ruleLink.off('click').on('click', function() {
			ruletxt.removeClass("hide");
			cover.show();
		});
	});
});
