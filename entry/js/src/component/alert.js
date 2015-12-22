define(['../../core/core'], function(core) {
	var alerts = {
		TEMPLATE: '<div class="alert-masker"></div><div class="alert-box"><div class="txt">info</div><div class="btns"><a class="btn ok">确认</a><a class="btn cancel">取消</a></div></div>',
		add: function(opts) {
			this.createElem(opts);
		},
		createElem: function(opts) {
			var This = this;
			var el = $(This.TEMPLATE),
				dom = opts.dom;
			el.find('.alert-box .txt').html(opts.txt);
			dom.append(el);
		},
		bindEvent: function() {

		},
		cancel: function() {

		}
	};
	return alerts;
});