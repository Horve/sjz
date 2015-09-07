define(function() {
	var Tools = {
		getCurrentStyle: function(elem, style) {
			var style;
			if (window.getComputedStyle) {
				var obj = window.getComputedStyle(elem, null);
				style = obj.getPropertyValue(style);
			} else {
				style = elem.currentStyle;
			}
			return style;
		}
	};
	return Tools;
});