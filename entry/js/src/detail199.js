define(['../core/core'], function(core) {
	core.onrender("detail-199", function(dom) {
		/*-webkit-animation: .5s detail-price-199;*/
		var Tools = core.Tools;

		var detail199 = {
			DOM_single: $('.single-page', dom),
			DOM_price: $('#detail-199-price', dom),

			init: function() {
				var _this = this;
				this.DOM_single
				var price_h = parseFloat(Tools.getCurrentStyle(_this.DOM_price[0], "width")) * 0.4;
				var single_h = parseFloat(Tools.getCurrentStyle(_this.DOM_single[0], "width")) / 0.5633;
				_this.DOM_price.css("height", price_h + "px");
				_this.DOM_single.css("height", single_h + "px");
				_this.DOM_price.addClass("price-animation");
			}
		};

		detail199.init();
	});
});