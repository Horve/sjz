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
		},
		scrollNum: function(elem) {
			var initi = 1;
			var num = $(elem).html();
			num = num.replace(/[^\d]/g, "") + "";
			var len = num.length;
			var content = ""; 

			for(var i = 0; i < len; i++) {
				content += '<i>0</i>';
			}
			$(elem).html(content);
			doscroll();

			function doscroll() {
				var ili = $(elem).find('i');
				var n = len - initi, tims = 0;
				var show = num.substring(len - initi, len - initi + 1);
				if (n < 0) return;
				var st = setInterval(function() {
					$(elem).find('i').eq(len - initi).html(parseInt(Math.random() * 10));
					tims += 1;
					if (tims >= 15) {
						clearInterval(st);
						$(elem).find('i').eq(len - initi).html(show);
						initi += 1;
						doscroll();
					}
				}, 50);
			}

		}
	};
	return Tools;
});