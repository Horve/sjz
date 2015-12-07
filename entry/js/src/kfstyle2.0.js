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
				productStyle = "甜橙";
				break;
			case "mag": 
				productStyle = "斑马";
				break;
			case "nav": 
				productStyle = "海风";
				break;
			case "cau": 
				productStyle = "木香";
				break;
		}
		document.title = productStyle + "-快翻-番薯快装";
		// var VM_hd = avalon.define({
		// 	$id: "head",
		// 	title: productStyle + "-快翻-番薯快装"
		// });
		var VM_kf = avalon.define({
			$id: "root",
			showBox: false,
			orderType: 1, // 1 立即 2 购物车
			txt: "一个卧室",
			btn: "立即下单",
			num: 1,
			layout: 0,
			styleCode: kftype,
			style: productStyle,
			type: kftype,
			price: 1999,
			topShow: false,
			detailNav: 3,
			screenWidth: $(window).width(),
			txtInfoShow: {
				// guahua: VM_kf.txtInfo["art"].guahua,
				// dengshi: VM_kf.txtInfo["art"].dengshi,
				// baozhen: VM_kf.txtInfo["art"].baozhen,
				// shafadian: VM_kf.txtInfo["art"].shafadian,
				// ditan: VM_kf.txtInfo["art"].ditan,
				// chuangpin: VM_kf.txtInfo["art"].chuangpin,
				// chuanglian: VM_kf.txtInfo["art"].chuanglian
			},
			fromShow: "",
			from: {
				art: "怡然家园 张先生",
				mag: "富力城  林女士",
				nav: "香江北岸 王先生",
				cau: "满庭芳园  齐先生"
			},
			txtInfo: {
				art: {
					guahua: "现代家居艺术，让每一寸美好都淋漓尽致。",
					dengshi: "欧式田园蕾丝台灯，寻找梦里那束隐约的温暖。",
					baozhen: "遇见北欧阳光，棉麻质地，意大利热压印花技术，柔软舒适易清洗，35度，黄金角完美支撑，人体供需设计，符合脊椎支撑结构。",
					shafadian: "简约粉色 保暖法兰绒，爱一种生活，是特别的嗜好。",
					ditan: "北欧简约风格，大气稳重，做工精细 毛质细柔，在家里拥有一个舒适的角落呵护最好的自己。",
					chuangpin: "北欧简约风素色纯棉环保活性印花，给你一个最温暖的拥抱。",
					chuanglian: "天然有机亲肤面料，三层织造物理遮光，夏日遮阳，冬季保暖。"
				},
				mag: {
					guahua: "北欧风格，专为简约家居设计，让艺术融入生活。",
					dengshi: "现代简约黑色诱惑台灯，典雅的宫廷气息，简单却充满欧式立体感。",
					baozhen: "遇见北欧阳光，棉麻质地，意大利热压印花技术，柔软舒适易清洗，35度，黄金角完美支撑，人体供需设计，符合脊椎支撑结构。",
					shafadian: "绒面细腻丰富，手感舒适，你需要的是我给你一种独具匠心的设计和多一点的用心、精致。",
					ditan: "北欧简约风格，大气稳重，做工精细 毛质细柔，在家里拥有一个舒适的角落呵护最好的自己。",
					chuangpin: "经典黑白纹水晶绒四件套，保暖无静电，手感如婴儿肌肤版柔软，和好梦来一场贴身的诱惑。",
					chuanglian: "天然有机亲肤面料，三层织造物理遮光，夏日遮阳，冬季保暖。"
				},
				nav: {
					guahua: "海星恋人无框装饰挂画，演绎家居新风尚。",
					dengshi: "现代简约白色诱惑台灯，典雅的宫廷气息，简单却充满欧式立体感。",
					baozhen: "遇见北欧阳光，棉麻质地，意大利热压印花技术，柔软舒适易清洗，35度，黄金角完美支撑，人体供需设计，符合脊椎支撑结构。",
					shafadian: "经典海军纹，全新防滑设计，全棉斜纹面料，先进染色工艺，环保透气。",
					ditan: "北欧简约风格，大气稳重，做工精细 毛质细柔，在家里拥有一个舒适的角落呵护最好的自己。",
					chuangpin: "北欧简约风素色纯棉环保活性印花，给你一个最温暖的拥抱。",
					chuanglian: "天然有机亲肤面料，三层织造物理遮光，夏日遮阳，冬季保暖。"
				},
				cau: {
					guahua: "北欧风格动物创意挂画，和自然来一次近距离呼吸。",
					dengshi: "现代简约温馨实木小台灯，带你进行一场心灵的回归。",
					baozhen: "遇见北欧阳光，棉麻质地，意大利热压印花技术，柔软舒适易清洗，35度，黄金角完美支撑，人体供需设计，符合脊椎支撑结构。",
					shafadian: "素雅田园风格，全新防滑设计，全棉斜纹面料，采用最传统的手工织造技术。",
					ditan: "北欧简约风格，大气稳重，做工精细 毛质细柔，在家里拥有一个舒适的角落呵护最好的自己。",
					chuangpin: "北欧简约风素色纯棉环保活性印花，给你一个最温暖的拥抱。",
					chuanglian: "天然有机亲肤面料，三层织造物理遮光，夏日遮阳，冬季保暖。"
				}
			},
			changeDNav: function(i) {
				VM_kf.detailNav = i;
			},
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
	    		VM_kf.showBox = false;
			},
			show: function() {
				VM_kf.txtInfoShow = {
					guahua: VM_kf.txtInfo[VM_kf.styleCode].guahua,
					dengshi: VM_kf.txtInfo[VM_kf.styleCode].dengshi,
					baozhen: VM_kf.txtInfo[VM_kf.styleCode].baozhen,
					shafadian: VM_kf.txtInfo[VM_kf.styleCode].shafadian,
					ditan: VM_kf.txtInfo[VM_kf.styleCode].ditan,
					chuangpin: VM_kf.txtInfo[VM_kf.styleCode].chuangpin,
					chuanglian: VM_kf.txtInfo[VM_kf.styleCode].chuanglian
				};
				VM_kf.fromShow = VM_kf.from[VM_kf.styleCode];
				// $('.area-compare', dom).css("height", VM_kf.screenWidth + "px");
			},
			toTop: function() {
				$('.view-content', dom).scrollTop(0);
				VM_kf.topShow = false;
			}
		});
		VM_kf.show();
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
					VM_kf.txt = "一室一厅、开间";
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
		$(dom).on('click', '.before-hide', function() {
			var _this = $(this);
			var _par = $(this).parent();
			_this.removeClass("oninit").addClass("active");
			$('.after', _par).addClass('onhide');
			setTimeout(function() {
				_par.find('.before-hide').removeClass('before-hide').addClass('before-show');
			}, 500);
		});
		$(dom).on('click', '.before-show', function() {
			var _this = $(this);
			var _par = $(this).parent();
			_this.addClass("oninit").removeClass("active");
			$('.after', _par).removeClass('onhide');
			setTimeout(function() {
				_par.find('.before-show').addClass('before-hide').removeClass('before-show');
			}, 500);
		});
	});
});
