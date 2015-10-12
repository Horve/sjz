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
			if (!!!num) return;
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
					if (tims >= 10) {
						clearInterval(st);
						$(elem).find('i').eq(len - initi).html(show);
						initi += 1;
						doscroll();
					}
				}, 50);
			}
		},
		lazyLoad: function(imgs) {
			function show(imgs, src) {
				$(imgs).css("opacity", 0);
				setTimeout(function() {
					$(imgs).attr("src", src);
					$(imgs).removeAttr("data-src");
					setTimeout(function(){
						$(imgs).css("opacity", 1);
					}, 0);
				},200);
			}
			if (typeof imgs === 'object' && Object.prototype.toString.call(imgs) === '[object Array]') {
				[].forEach.call(imgs, function(img) {
					(function() {
						var src = $(img).attr("data-src");
						if (src) {
							show(img, src);
						}
					})(img);
					
				});
			} else {
				var src = $(imgs).attr("data-src");
				if (src) {
					show(imgs, src);
				}
			}
		},
		// x 减去的额外高度 y 均分的份数
		calcSepHeight: function(x, y) {
			var winHei = $(window).height();
			return (winHei - x) / y;
		}
	};
	var Tools = Tools;
	return Tools;
});