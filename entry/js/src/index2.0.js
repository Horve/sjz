define(['../core/core'], function(core) {
	core.onrender("index-2-0", function(dom) {
		/*-webkit-animation: .5s detail-price-199;*/
		var Tools = core.Tools
			, u = navigator.userAgent
			, isAndroid = u.indexOf('Android') > -1 || u.indexOf('Linux') > -1 //android终端或者uc浏览器
			, EL_slide = $('#focus-slide', dom)
			, EL_compare = $('.compare', dom)
			, EL_topCmp = $('.compare .top', dom)
			, EL_compareCnt = $('.compare-cnt', dom)
			, EL_topBtm = $('.compare .bottom', dom)
			, EL_androidCmp = $('#compare-slide', dom)
			, EL_topBg = $('.compare .all-img', dom)
			, winWidth = $('body').width()
			, winHeight = $('body').height();
		EL_slide.css("height", winWidth * 0.55 + "px");
		EL_topBg.css("width", winWidth + "px");
		EL_topCmp.css({"width": winWidth - 50 + "px"});

		if (isAndroid) {
			EL_compareCnt.hide();
			EL_androidCmp.show();
			$('html').removeClass("ios").addClass("android-html");
			EL_androidCmp.css("height", (winHeight - winWidth * 0.55 - 50) + "px");
		} else {
			EL_compareCnt.show();
			EL_androidCmp.hide();
			$('html').removeClass("android").addClass("ios-html");
			EL_compareCnt.css("height", (winHeight - winWidth * 0.55 - 50) + "px");
		}
		
		var focusSlide = new Swiper('#focus-slide',{
			// direction: 'vertical'
			autoplay: 5000,
			pagination: '.swiper-pagination'
		});
		var compareSlide = new Swiper('#compare-slide',{
			effect : 'fade',
			fade: {
			  crossFade: false,
			},
			onSlideChangeEnd: function(swiper){
				var index = swiper.activeIndex;
				if (index == 0) {
					$('.android-html .compare-txt-left').css("opacity", 0);
					$('.android-html .compare-txt-right').css("opacity", 1);
				} else if (index ==1) {
					$('.android-html .compare-txt-left').css("opacity", 1);
					$('.android-html .compare-txt-right').css("opacity", 0);
				}
			}
		});

		var downLeft = [0,0], initWid, initLeft, isMove = false;
		$(dom).on('click', '.compare .bottom', function(e) {
			initWid = 50;
			initLeft = winWidth - 50;
			EL_topCmp.attr("style", "-webkit-transition-duration:0.3s; width:" + initWid + "px;");
			$('.ios-html .compare-txt-left .ico').css("opacity", 0);
			$('.ios-html .compare-txt-right .ico').css("opacity", 1);
		});
		$(dom).on('click', '.compare .top', function(e) {
			initWid = winWidth - 50;
			initLeft = 50;
			EL_topCmp.attr("style", "-webkit-transition-duration:0.3s; width:" + initWid + "px;");
			$('.ios-html .compare-txt-left .ico').css("opacity", 1);
			$('.ios-html .compare-txt-right .ico').css("opacity", 0);
		});
		// $(dom).on('touchstart', '.compare', function(e) {
		// 	isMove = false;
		// 	e.preventDefault();
		// 	var touchs = e.changedTouches[0];
		// 	var tx = touchs.pageX;
		// 	downLeft.shift();
		// 	downLeft.push(tx);
		// 	initWid = EL_topCmp.width();
		// 	initLeft = winWidth - initWid;
		// 	// console.log(downLeft);
		// });
		// $(dom).on('touchmove', '.compare', function(e) {
		// 	e.preventDefault();
		// 	isMove = true;
		// 	var touchs = e.changedTouches[0];
		// 	var tx = touchs.pageX;
		// 	var moveDis = 0;
		// 	downLeft.shift();
		// 	downLeft.push(tx);
		// 	// console.log(downLeft);
		// 	moveDis = downLeft[1] - downLeft[0];
		// 	initWid -= moveDis;
		// 	initLeft += moveDis;
		// 	if (initLeft < 40) {
		// 		initLeft = 40;
		// 	} else if (initLeft > winWidth - 40) {
		// 		initLeft = winWidth - 40;
		// 	}
		// 	if (initWid > winWidth - 40) {
		// 		initWid = winWidth - 40;
		// 	} else if (initWid < 40) {
		// 		initWid = 40;
		// 	}
		// 	console.log(downLeft);
		// 	EL_topCmp.attr("style", "left:auto; -webkit-transition-duration:0s; -webkit-transform: translate3d(" + initLeft + "px, 0px, 0px); width:" + initWid + "px; background-size:" + 1 / parseFloat(initWid / (winWidth - 40)).toFixed(2) * 100 + "% 100%");
		// });
		// $(dom).on('touchend', '.compare', function(e) {
		// 	console.log(isMove);
		// 	e.preventDefault();
		// 	var touchs = e.changedTouches[0];
		// 	var tx = touchs.pageX;
		// 	if (isMove && (downLeft[0] < downLeft[1])) {
		// 		// right
		// 		initWid = 40;
		// 		initLeft = winWidth - 40;
		// 		if (!isAndroid) {
		// 			$('.ios-html .compare-txt-left .ico').css("opacity", 0);
		// 			$('.ios-html .compare-txt-right .ico').css("opacity", 1);
		// 		}
		// 	} else if (isMove && (downLeft[0] > downLeft[1])) {
		// 		// left
		// 		initLeft = 40;
		// 		initWid = winWidth - 40;
		// 		if (!isAndroid) {
		// 			$('.ios-html .compare-txt-left .ico').css("opacity", 1);
		// 			$('.ios-html .compare-txt-right .ico').css("opacity", 0);
		// 		}
		// 	}
		// 	EL_topCmp.attr("style", "left:auto; -webkit-transition-duration:0s; -webkit-transform: translate3d(" + initLeft + "px, 0px, 0px); width:" + initWid + "px; background-size:" + 1 / parseFloat(initWid / (winWidth - 40)).toFixed(2) * 100 + "% 100%");
		// 	// EL_topCmp.removeAttr("style");
		// });
		// $('.hover-hand', dom).on("webkitAnimationEnd", function() {
		// 	$(this).hide();
		// });
	});
});