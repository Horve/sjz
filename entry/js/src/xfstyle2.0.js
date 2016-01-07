define(['../core/core', './jump', './component/dialog', '../src/order'], function(core, checkUsr, dialog, OrderConfig) {
	core.onrender("xf-style-2-0", function(dom) {
		/*-webkit-animation: .5s detail-price-199;*/
		// 设置跳转返回目标页
		localStorage.setItem("_prepage", window.location.href);
		// random
		function rd(n,m){
		    var c = m-n+1;  
		    return Math.floor(Math.random() * c + n);
		}
		var stars = [3,4,5];
		var roomstyle = ["一居室","两居室","三居室","单间"];
		var hashToJson = function(hash) {
			var hash = hash.replace("#!_",""), json = {}, arr = hash.split("&");
			arr.forEach(function(item) {
				json[item.split("=")[0]] = item.split("=")[1];
			});
			return json;
		};
		var Tools = core.Tools;
		var baseUrl = Tools.returnBaseUrl();
		var hash = location.hash;
		var xfstyle = hashToJson(hash).sty || "art";
		var xfprod = hashToJson(hash).pro || "yingzhuang";
		var productStyle = "";
		var Tools = core.Tools
			, EL_comparePic = $('.area-compare .onhide')
			, tipsTop = $('#tipsPos', dom).offset().top
			, productTop = $('.product-nav', dom).offset().top;

		// $('.area-compare .onhide').on('click', function() {
		// 	$(this).removeClass('onhide').addClass('onshow').siblings().removeClass('onshow').addClass('onhide');
		// 	alert($(this).attr("class"));
		// });
		var mySwiper = new Swiper('.swiper-container', {
			autoplay: 5000,//可选选项，自动滑动
			pagination : '.swiper-pagination',
		});
		$(dom).on('click', '.onhide', function() {
			$(this).removeClass('onhide').addClass('onshow').siblings().removeClass('onshow').addClass('onhide');
		});
		$('.view-content', dom).on("scroll", function() {
			var scrolltop = $(this).scrollTop();
			if(scrolltop >= productTop) {
				// VM_xf.totopShow = true;
			} else {
				// VM_xf.totopShow = false;
			}
		});
		$('.page-tips', dom).css("top",tipsTop + "px");
		switch(xfstyle) {
			case "art": 
				productStyle = "甜橙";
				break;
			case "mag": 
				productStyle = "斑马";
				break;
			case "nav": 
				productStyle = "海洋";
				break;
			case "cau": 
				productStyle = "木香";
				break;
		}
		document.title = productStyle + "-新房-番薯快装";
		// var VM_hd = avalon.define({
		// 	$id: "head",
		// 	title: productStyle + "-快翻-番薯快装"
		// });
		
		var VM_xf = avalon.define({
			$id: "root",
			yyOkhide: false,
			detailNav: 1,
			productNav: 1,
			productName: "yingzhuang",
			styleName: "art",

			changeDNav: function(i) {
				VM_xf.detailNav = i;
			},
			changePNav: function(i) {
				VM_xf.productNav = i;
			}
		});
		avalon.scan();

		$(dom).on('click', '.before-hide', function() {
			var _this = $(this);
			var _par = $(this).parent();
			_this.removeClass("oninit").addClass("active");
			$('.after', _par).addClass('onhide');
			// if (!!_this.attr("data-wltype")) {
			// 	VM_xf.wltype = _this.attr("data-wltype");
			// }
			if ($(this).hasClass('big-show')) {
				$(this).parent().find('.cmp-txtinfo').html('翻新前');
			}
			setTimeout(function() {
				_par.find('.before-hide').removeClass('before-hide').addClass('before-show');
			}, 500);
		});
		$(dom).on('click', '.before-show', function() {
			var _this = $(this);
			var _par = $(this).parent();
			// VM_xf.wltype = 1;
			_this.addClass("oninit").removeClass("active");
			$('.after', _par).removeClass('onhide');
			if ($(this).hasClass('big-show')) {
				$(this).parent().find('.cmp-txtinfo').html('翻新后');
			}
			setTimeout(function() {
				_par.find('.before-show').addClass('before-hide').removeClass('before-show');
			}, 500);
		});
	});
});
