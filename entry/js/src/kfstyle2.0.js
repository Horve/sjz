define(['../core/core', './jump', './component/dialog', '../src/order'], function(core, checkUsr, dialog, OrderConfig) {
	core.onrender("kf-style-2-0", function(dom) {
		/*-webkit-animation: .5s detail-price-199;*/
		// 设置跳转返回目标页
		localStorage.setItem("_prepage", window.location.href);
		
		var baseUrl = "http://www.s-jz.com/pub/Sbuild/";
		var kftype = location.hash.replace(/#!_/,"") || "art";
		var productStyle = "";
		var Tools = core.Tools
			, EL_comparePic = $('.area-compare .onhide');

		// $('.area-compare .onhide').on('click', function() {
		// 	$(this).removeClass('onhide').addClass('onshow').siblings().removeClass('onshow').addClass('onhide');
		// 	alert($(this).attr("class"));
		// });
		$(dom).on('click', '.onhide', function() {
			$(this).removeClass('onhide').addClass('onshow').siblings().removeClass('onshow').addClass('onhide');
		});
		switch(kftype) {
			case "art": 
				productStyle = "橙子";
				break;
			case "mag": 
				productStyle = "斑马";
				break;
			case "nav": 
				productStyle = "海风";
				break;
			case "cau": 
				productStyle = "森林";
				break;
		}
		var VM_kf = avalon.define({
			$id: "root",
			showBox: false,
			orderType: 1, // 1 立即 2 购物车
			txt: "一个卧室",
			btn: "立即下单",
			num: 1,
			layout: 0,
			style: productStyle,
			type: kftype,
			price: 1999,
			changeBoxState: function(n) {
				(!VM_kf.showBox) && (VM_kf.showBox = true);
				VM_kf.orderType = n;
				if (n == 1) {
					VM_kf.btn = "立即下单";
				} else if (n == 2) {
					VM_kf.btn = "加入购物车";
				}
			},
			closeBox: function() {
				VM_kf.showBox = false;
			},
			ajaxOrder: function() {
				var params;
				if (VM_kf.num) {
	    			params = '"nums": 1,"productStyle":"' + productStyle + '"';
	    		} else {
	    			params = '"layout": ' + VM_kf.layout + ',"productStyle":"' + productStyle + '"';
	    		}
	    		console.log(params);
	    		if (VM_kf.orderType == 1) {
	    			OrderConfig.addOrderAjax(1, params);
	    		} else if (VM_kf.orderType == 2) {
	    			OrderConfig.addToShopChart(1, params);
	    		}
			}
		});
		avalon.scan();
		
		$('.options .option a.item', dom).off('click').on('click', function() {
			$(this).addClass('on').siblings().removeClass('on');
			var index = $(this).index();
			switch(index) {
				case 0:
					VM_kf.txt = "一个卧室";
					VM_kf.price = 1999;
					VM_kf.num = 1;
					break;
				case 1:
					VM_kf.txt = "一室一厅（开间）";
					VM_kf.price = 3600;
					VM_kf.layout = 1;
					VM_kf.num = 0;
					break;
				case 2:
					VM_kf.txt = "两室一厅";
					VM_kf.price = 5499;
					VM_kf.layout = 2;
					VM_kf.num = 0;
					break;
				case 3:
					VM_kf.txt = "三室一厅";
					VM_kf.price = 7399;
					VM_kf.layout = 3;
					VM_kf.num = 0;
					break;
			}
		});
		

	});
});