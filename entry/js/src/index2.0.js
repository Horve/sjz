define(['../core/core'], function(core) {
	core.onrender("index-2-0", function(dom) {
		/*-webkit-animation: .5s detail-price-199;*/
		var Tools = core.Tools
			, u = navigator.userAgent
			, isAndroid = u.indexOf('Android') > -1 || u.indexOf('Linux') > -1 //android终端或者uc浏览器
			, EL_slide = $('#focus-slide', dom)
			, EL_compare = $('.compare', dom)
			, EL_topCmp = $('.compare .top', dom)
			, EL_topBtm = $('.compare .bottom', dom)
			, EL_androidCmp = $('#compare-slide', dom)
			, winWidth = $('body').width()
			, winHeight = $('body').height();
		EL_slide.css("height", winWidth * 0.55 + "px");
		if (isAndroid) {
			EL_compare.hide();
			EL_androidCmp.show();
			EL_androidCmp.css("height", (winHeight - winWidth * 0.55 - 50) + "px");
		} else {
			EL_compare.show();
			EL_androidCmp.hide();
			EL_compare.css("height", (winHeight - winWidth * 0.55 - 50) + "px");
		}
		
		var focusSlide = new Swiper('#focus-slide',{
			// direction: 'vertical'
			pagination: '.swiper-pagination'
		});
		var compareSlide = new Swiper('#compare-slide',{});

		var downLeft = [0,0], initWid, initLeft;
		EL_topCmp.on('touchstart', function(e) {
			var touchs = e.changedTouches[0];
			var tx = touchs.pageX;
			downLeft.shift();
			downLeft.push(tx);
			initWid = EL_topCmp.width();
			initLeft = winWidth - initWid;
			// console.log(downLeft);
		});
		$(dom).on('touchmove', '.compare .top', function(e) {
			var touchs = e.changedTouches[0];
			var tx = touchs.pageX;
			var moveDis = 0;
			downLeft.shift();
			downLeft.push(tx);
			// console.log(downLeft);
			moveDis = downLeft[1] - downLeft[0];
			initWid -= moveDis;
			initLeft += moveDis;
			console.log(tx,initWid);
			EL_topCmp.attr("style", "left:auto; -webkit-transform: translate3d(" + initLeft + "px, 0px, 0px); width:" + initWid + "px; background-size:" + 1 / (initWid / winWidth) * 100 + "% 100%");
		});
	});
});