define(['../core/core', './component/dialog', './jump'], function(core, dialog, checkUsr) {
	core.onrender("help", function(dom) {
		var qaTitle = $('.qa-box .tle', dom);
		var VM_help= avalon.define({
			$id: "root",
			showType: "changjian",
			changeType: function(type) {
				VM_help.showType = type;
			}
		});
		avalon.scan();
		$(dom).on('click', '.qa-box .tle', function() {
			var par = $(this).parent();
			if (!par.hasClass('show')) {
				par.addClass('show').siblings().removeClass('show');
			} else {
				par.removeClass('show');
			}
		});
	});
});
