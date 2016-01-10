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
		var danjia = 458;
		var roomstyle = ["一居室","两居室","三居室","单间"];
		var hashToJson = function(hash) {
			var hash = hash.replace("#!_",""), json = {}, arr = hash.split("&");
			arr.forEach(function(item) {
				json[item.split("=")[0]] = item.split("=")[1];
			});
			return json;
		};
		var jiadianPrice = [7288, 8888, 10688]
			, jiajuPrice = [3000, 4800, 6500]
			, productTop = $('.product-nav', dom).offset().top;;

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
			console.log(productTop);

		// $('.area-compare .onhide').on('click', function() {
		// 	$(this).removeClass('onhide').addClass('onshow').siblings().removeClass('onshow').addClass('onhide');
		// 	alert($(this).attr("class"));
		// });
		
		function scrollBind(productTop) {
			$('.view-content', dom).on("scroll", function() {
				var scrolltop = $(this).scrollTop();
				if(scrolltop >= productTop) {
					VM_xf.totopShow = true;
				} else {
					VM_xf.totopShow = false;
				}
			});
		}
		var mySwiper = new Swiper('.swiper-container', {
			autoplay: 5000,//可选选项，自动滑动
			pagination : '.swiper-pagination',
		});
		$(dom).on('click', '.onhide', function() {
			$(this).removeClass('onhide').addClass('onshow').siblings().removeClass('onshow').addClass('onhide');
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
		console.log(xfstyle);
		var VM_xf = avalon.define({
			$id: "root",
			yyOkhide: false,
			totopShow: false,
			detailNav: 1,
			productNav: 1,
			productName: "yingzhuang",
			styleName: xfstyle,
			styleTxt: productStyle,
			xfproduct: "jiaju",
			focusInfo: "七大家电，解决您的一站式需求",
			showOrder: false,
			yushi: 0,
			yangtai: 0,
			price: 0,
			square: "",
			roomNum: 1,

			commentShow: [],
			commentArr: {
				art: [
					{
						stars1: stars[rd(1,3)-1],
						stars2: stars[rd(1,3)-1],
						stars3: stars[rd(1,3)-1],
						rooms: roomstyle[rd(1,4)-1],
						uname: "番薯用户",
						ctime: "2015/11/26",
						hpic: "../../dist/img/2_0/kf/headpic/1.jpg",
						txt: "第一次尝试这种快速翻新的装修，没有让我失望，小价钱大实惠，给了很多专业的建议，不用自己费劲再去找了其他装修公司，服务态度非常好，装修速度超快，不用担心时间，喜欢的话一天就可以改变一个家，点赞!!!!"
					},
					{
						stars1: stars[rd(1,3)-1],
						stars2: stars[rd(1,3)-1],
						stars3: stars[rd(1,3)-1],
						rooms: roomstyle[rd(1,4)-1],
						uname: "番薯用户",
						ctime: "2015/11/21",
						hpic: "../../dist/img/2_0/kf/headpic/2.jpg",
						txt: "一切都很顺利，现在施工进行挺快的，对施工效果很满意，如果能够混搭一下木香里的床品就太完美了，希望你们以后在产品的搭配方面更灵活一下。"
					},
					{
						stars1: stars[rd(1,3)-1],
						stars2: stars[rd(1,3)-1],
						stars3: stars[rd(1,3)-1],
						rooms: roomstyle[rd(1,4)-1],
						uname: "番薯用户",
						ctime: "2015/11/19",
						hpic: "../../dist/img/2_0/kf/headpic/3.jpg",
						txt: "番薯服务很到位，公司还是很正规可靠的，客服耐心的给我做介绍，根据我提的要求，给我推荐合适的风格，设计人员上门给我量房，服务态度好，非常满意"
					},
					{
						stars1: stars[rd(1,3)-1],
						stars2: stars[rd(1,3)-1],
						stars3: stars[rd(1,3)-1],
						rooms: roomstyle[rd(1,4)-1],
						uname: "番薯用户",
						ctime: "2015/11/16",
						hpic: "../../dist/img/2_0/kf/headpic/4.jpg",
						txt: "由于工作繁忙，也没有太多的时间，开始有些担心，是否能有效果图的好，结果是令我们很满意的"
					},
					{
						stars1: stars[rd(1,3)-1],
						stars2: stars[rd(1,3)-1],
						stars3: stars[rd(1,3)-1],
						rooms: roomstyle[rd(1,4)-1],
						uname: "番薯用户",
						ctime: "2015/11/14",
						hpic: "../../dist/img/2_0/kf/headpic/5.jpg",
						txt: "设计风格的不错，装修后的感觉是简单明亮的舒适环境，改变了我们的居住环境，足以让人 消除一天的烦恼。没有过多繁复的设计，以简洁的造型、纯洁的质地、精细的工艺为其特征，为我们展现了更温馨舒适 的居住环境"
					}
				],
				nav: [
					{
						stars1: stars[rd(1,3)-1],
						stars2: stars[rd(1,3)-1],
						stars3: stars[rd(1,3)-1],
						rooms: roomstyle[rd(1,4)-1],
						uname: "番薯用户",
						ctime: "2015/12/01",
						hpic: "../../dist/img/2_0/kf/headpic/12.jpg",
						txt: "从客服到设计师都不错，服务周到，很多不懂得他们很有耐心的给我解答，很负责任。给我们想到了每一个角落每一个细节。 而且不光从美观考虑，还从经济方面为我们考虑的很周全"
					},
					{
						stars1: stars[rd(1,3)-1],
						stars2: stars[rd(1,3)-1],
						stars3: stars[rd(1,3)-1],
						rooms: roomstyle[rd(1,4)-1],
						uname: "番薯用户",
						ctime: "2015/11/18",
						hpic: "../../dist/img/2_0/kf/headpic/13.jpg",
						txt: "施工的李师傅很赞，很负责任，壁纸贴的很细心，服务很好很客气的，开始我在担心后需要自己打扫，而且很麻烦，番薯给了我惊喜，施工完后还有专业的保洁来给做保洁。真的是很省心的。给你们点赞呢。"
					},
					{
						stars1: stars[rd(1,3)-1],
						stars2: stars[rd(1,3)-1],
						stars3: stars[rd(1,3)-1],
						rooms: roomstyle[rd(1,4)-1],
						uname: "番薯用户",
						ctime: "2015/11/16",
						hpic: "../../dist/img/2_0/kf/headpic/14.jpg",
						txt: "只能说番薯的效率很高啊，一天就给了我一个温馨的家。感谢你们。"
					},
					{
						stars1: stars[rd(1,3)-1],
						stars2: stars[rd(1,3)-1],
						stars3: stars[rd(1,3)-1],
						rooms: roomstyle[rd(1,4)-1],
						uname: "番薯用户",
						ctime: "2015/11/15",
						hpic: "../../dist/img/2_0/kf/headpic/15.jpg",
						txt: "为了提高生活品质，想把老房子翻新一下，我们的想法是不希望大动，无意间看到了番薯快装，就给番薯打了电话觉得番薯的客服小艾特别好，给我解释的很详细。一直都很有耐心。价格也很合理，算是经济适用吧，既能改变居住环境也不用花太多的钱。装修后的效果我非常满意的！"
					},
					{
						stars1: stars[rd(1,3)-1],
						stars2: stars[rd(1,3)-1],
						stars3: stars[rd(1,3)-1],
						rooms: roomstyle[rd(1,4)-1],
						uname: "番薯用户",
						ctime: "2015/11/15",
						hpic: "../../dist/img/2_0/kf/headpic/16.jpg",
						txt: "为了提高生活品质，想把老房子翻新一下，我们的想法是不希望大动，无意间看到了番薯快装，就给番薯打了电话觉得番薯的客服小艾特别好，给我解释的很详细。一直都很有耐心。价格也很合理，算是经济适用吧，既能改变居住环境也不用花太多的钱。装修后的效果我非常满意的！"
					},
					{
						stars1: stars[rd(1,3)-1],
						stars2: stars[rd(1,3)-1],
						stars3: stars[rd(1,3)-1],
						rooms: roomstyle[rd(1,4)-1],
						uname: "番薯用户",
						ctime: "2015/11/08",
						hpic: "../../dist/img/2_0/kf/headpic/17.jpg",
						txt: "看了四种装修风格，最终先了套适合自己的海洋风，比较喜欢，满意，不过还是希望番薯家能多些方案，这样我们的选择空间也会很大。"
					}
				],
				mag: [
					{
						stars1: stars[rd(1,3)-1],
						stars2: stars[rd(1,3)-1],
						stars3: stars[rd(1,3)-1],
						rooms: roomstyle[rd(1,4)-1],
						uname: "番薯用户",
						ctime: "2015/12/02",
						hpic: "../../dist/img/2_0/kf/headpic/30.jpg",
						txt: "对于单身男子汉来讲，斑马很适合我的，装修后的效果也很不错的，租房子的我能有这么个居住环境已经很高档啦，我想这个应该有利于我找女朋友吧。哈哈哈哈哈。。"
					},
					{
						stars1: stars[rd(1,3)-1],
						stars2: stars[rd(1,3)-1],
						stars3: stars[rd(1,3)-1],
						rooms: roomstyle[rd(1,4)-1],
						uname: "番薯用户",
						ctime: "2015/11/25",
						hpic: "../../dist/img/2_0/kf/headpic/31.jpg",
						txt: "简易了复杂的装修过程，效果不简易，质量不简单，喜欢。"
					},
					{
						stars1: stars[rd(1,3)-1],
						stars2: stars[rd(1,3)-1],
						stars3: stars[rd(1,3)-1],
						rooms: roomstyle[rd(1,4)-1],
						uname: "番薯用户",
						ctime: "2015/11/21",
						hpic: "../../dist/img/2_0/kf/headpic/32.jpg",
						txt: "很满意，大气，质量也好。售前售后服务都很耐心细致，也很专业！施工的工人有点问题，反映给售后马上就解决了。是一家不错的店下次有需要还会来的，都推荐给朋友啦  啦啦啦 ~"
					},
					{
						stars1: stars[rd(1,3)-1],
						stars2: stars[rd(1,3)-1],
						stars3: stars[rd(1,3)-1],
						rooms: roomstyle[rd(1,4)-1],
						uname: "番薯用户",
						ctime: "2015/11/18",
						hpic: "../../dist/img/2_0/kf/headpic/33.jpg",
						txt: "整体都满意，除了气味稍微有点,质量很满意，都做得很细致，细节处理很不错！追加一下，客服人员思念服务的很到位，有耐心有责任感！每次都能耐心的帮我解答，从来没有不耐烦！给你点个赞"
					},
					{
						stars1: stars[rd(1,3)-1],
						stars2: stars[rd(1,3)-1],
						stars3: stars[rd(1,3)-1],
						rooms: roomstyle[rd(1,4)-1],
						uname: "番薯用户",
						ctime: "2015/11/15",
						hpic: "../../dist/img/2_0/kf/headpic/34.jpg",
						txt: "施工完家里高端大气上档次，值得亲们购买，值得拥有！"
					}
				],
				cau: [
					{
						stars1: stars[rd(1,3)-1],
						stars2: stars[rd(1,3)-1],
						stars3: stars[rd(1,3)-1],
						rooms: roomstyle[rd(1,4)-1],
						uname: "番薯用户",
						ctime: "2015/11/28",
						hpic: "../../dist/img/2_0/kf/headpic/39.jpg",
						txt: "品质保证，服务周到，好评啊，推荐给其他小伙伴们。"
					},
					{
						stars1: stars[rd(1,3)-1],
						stars2: stars[rd(1,3)-1],
						stars3: stars[rd(1,3)-1],
						rooms: roomstyle[rd(1,4)-1],
						uname: "番薯用户",
						ctime: "2015/11/25",
						hpic: "../../dist/img/2_0/kf/headpic/40.jpg",
						txt: "开始有些担心，是否能有效果图的好，结果是们很满意的。看来我的钱是没有白花的，你值得拥有，哈哈哈"
					},
					{
						stars1: stars[rd(1,3)-1],
						stars2: stars[rd(1,3)-1],
						stars3: stars[rd(1,3)-1],
						rooms: roomstyle[rd(1,4)-1],
						uname: "番薯用户",
						ctime: "2015/11/22",
						hpic: "../../dist/img/2_0/kf/headpic/41.jpg",
						txt: "一直觉得装修是件非常累且熬人的事情，由于工作繁忙，太多的时间也没有，所以这件事晴一直搁置着，知道我无意间看见了番薯快装，他们的人员都很认真尽责。产品设计也切实替我们这些北漂族着想，绝对好评！虽然现在出了些小插曲，但番薯相当负责，从客服到施工都主动询问帮助，现在问题解决，番薯很是专业。"
					},
					{
						stars1: stars[rd(1,3)-1],
						stars2: stars[rd(1,3)-1],
						stars3: stars[rd(1,3)-1],
						rooms: roomstyle[rd(1,4)-1],
						uname: "番薯用户",
						ctime: "2015/11/20",
						hpic: "../../dist/img/2_0/kf/headpic/42.jpg",
						txt: "过程简单快捷，先是拍下产品，然后番薯的客服联系了我，根据我的休息时间最后确定了施工时间，有设计人员上门来为我量房子，之后就是物流送物料，然后就是施工，最后客服回访，整个过程不到一周，我现在就住在了装修的新房子里。真是一个拼速度的时代啊。"
					}
				]
			},
			init: function() {
			 	VM_xf.commentShow = VM_xf.commentArr[xfstyle];
			 	console.log(VM_xf.commentShow);
			},
			changeDNav: function(i) {
				VM_xf.detailNav = i;
			},
			changePNav: function(i) {
				VM_xf.productNav = i;
				if (i == 2) {
					VM_xf.xfproduct = "jiaju";
					VM_xf.focusInfo = "九大类家具，满足您的生活所需";
				} else if (i == 3) {
					VM_xf.xfproduct = "jiadian";
					VM_xf.focusInfo = "七大家电，解决您的一站式需求";
				}
			},
			showOrderBox: function() {
				if (VM_xf.productNav == 2) {
					// jiaju
					VM_xf.price = jiajuPrice[VM_xf.roomNum - 1];
				} else if (VM_xf.productNav == 3) {
					VM_xf.price = jiadianPrice[VM_xf.roomNum - 1];
				} else {
					VM_xf.price = 0;
				}
				VM_xf.yushi = 0;
				VM_xf.yangtai = 0;
				VM_xf.square = "";
				VM_xf.showOrder = true;
			},
			hideOrderBox: function() {
				VM_xf.showOrder = false;
			},
			addProduct: function(addName) {
				var num = $(this).attr("data-num");
				if (num == VM_xf[addName]) {
					VM_xf[addName] = 0;
				} else {
					VM_xf[addName] = num;
				}
				VM_xf.totalPrice();
			},
			totalPrice: function() {
				VM_xf.price = danjia * VM_xf.square + VM_xf.yushi * 3500 + VM_xf.yangtai * 1000;
			},
			orderYY: function() {
				var params;
				if (VM_xf.productNav == 1) {
					params = '"acreage":' + (VM_xf.square || 100) 
						+ ',"balconyNum":' + VM_xf.yangtai
						+ ',"toiletNum":' + VM_xf.yushi
						+ ',"productStyle":"' + productStyle + '"';
    				OrderConfig.addToShopChart(2, params);
				} else if (VM_xf.productNav == 2) {
					params = '"layout": ' + VM_xf.roomNum + ',"productStyle":"' + productStyle + '"';
					OrderConfig.addToShopChart(4, params);
				} else if (VM_xf.productNav == 3) {
					params = '"layout": ' + VM_xf.roomNum + ',"productStyle":"' + productStyle + '"';
					OrderConfig.addToShopChart(5, params);
				}
				VM_xf.showOrder = false;
				console.log(params);
			},
			roomNumChg: function() {
				
				VM_xf.roomNum = $(this).attr("data-num");
				if (VM_xf.productNav == 2) {
					// jiaju
					VM_xf.price = jiajuPrice[VM_xf.roomNum - 1];
				} else if (VM_xf.productNav == 3) {
					VM_xf.price = jiadianPrice[VM_xf.roomNum - 1];
				}
			},
			toTop: function() {
				$('.view-content', dom).scrollTop(productTop - 45);
				VM_xf.topShow = false;
			},
			closeyyTips: function() {
				VM_xf.yyOkhide = false;
			}
		});
		VM_xf.$watch("square", function(a, b)　{
			VM_xf.totalPrice();
		});
		VM_xf.init();
		avalon.scan();
		avalon.duplexHooks.square = {
			get: function(val) {
				return val;
			},
			set: function(val) {
				return val;
			}
		};

		productTop = $('.product-nav', dom).offset().top;
		scrollBind(productTop);

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
