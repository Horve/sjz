define(['../core/core'], function(core) {
	var Tools = core.Tools;

	var quoteres = {
		DOM_item_block: $('.block-item'),
		DOM_item_block_item: $('.block-item .block'),
		DOM_button: $('.quoteres .button-comm'),

		init: function() {
			var _this = this;
			var width_block = Tools.getCurrentStyle(this.DOM_item_block[0], "width");
			var width_item = Tools.getCurrentStyle(this.DOM_item_block_item[0], "width");
			this.DOM_item_block.css("height", width_block);
			this.DOM_item_block_item.css("height", width_item);
			setTimeout(function() {
				[].forEach.call(_this.DOM_item_block_item, function(item, index) {
					$(item).addClass("animation" + (index + 1));
				});
				// _this.DOM_button.css("opacity", 1);
				_this.DOM_button.addClass("animation5");
				
			}, 0);
		}
	};

	quoteres.init();
});