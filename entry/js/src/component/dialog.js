define(['../../core/core'], function(core) {
	var isfirst = true;
	var allData = [];
	var dialog = {
		TEMPLATE: '<div class="dialog-mask"></div><div class="dialog-body"><p></p><a class="button-ok">确定</a></div>',
		callback: null,
		add: function(txt, fn) {
			console.log("Enter dialog Component!");
			var _this = this;
			_this.beforeShow(txt);
			fn && (_this.callback = fn);
		},
		beforeShow: function(txt) {
			var _this = this;
			var dialog;
			if (!$('.dialog-mask').length) {
				dialog = $(_this.TEMPLATE);
				isfirst = true;
			} else {
				dialog = $('.dialog-mask, .dialog-body');
				isfirst = false;
			}
			dialog.find('p').html(txt);
			if (isfirst) {
				$('body').append(dialog);
				setTimeout(function() {
					_this.show($('.dialog-body'), _this);
				}, 100);
			} else {
				$('.dialog-body, .dialog-mask').show();
				_this.show($('.dialog-body'), _this);
			}
		},

		show: function(el, _this) {
			var elH = $(el).height();
			$(el).attr("style", "-webkit-transform: translate3d(0,0,0) translateY(-" + elH + "px);");
			_this.hideBind(el);
		},
		hide: function(el) {
			// $(el).removeClass("anim");
			$(el).attr("style", "-webkit-transform: translate3d(0,0,0);");
			$('.dialog-mask').hide();
			this.afterHide();
		},
		hideBind: function(el) {
			var _this = this;
			$('.dialog-mask, .button-ok').off('click').on('click', function() {
				_this.hide(el);
				if ($(this).hasClass("button-ok")) {
					_this.callback();
				}
			});
		},
		afterHide: function() {
			setTimeout(function() {
				$('.dialog-body').hide();
			}, 300);
		}
	};
	window.dialog = dialog;
	return dialog;
});