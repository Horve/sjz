define(['../core/core', './jump', './component/dialog', '../src/order'], function(core, checkUsr, dialog, OrderConfig) {
	core.onrender("kf-style-2-0", function(dom) {
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

		var Tools = core.Tools;
		var baseUrl = Tools.returnBaseUrl();
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
				productStyle = "海洋";
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
			detailNav: 1,
			wltype: 1,
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
					},
					{
						stars1: stars[rd(1,3)-1],
						stars2: stars[rd(1,3)-1],
						stars3: stars[rd(1,3)-1],
						rooms: roomstyle[rd(1,4)-1],
						uname: "番薯用户",
						ctime: "2015/11/09",
						hpic: "../../dist/img/2_0/kf/headpic/6.jpg",
						txt: "现在网上和实体店装修的太多了，选择番薯装修的时候也是经过很久的筛选，现在看来，选番薯是正确的，整个合作施工过程中，施工人员非常到位，非常满意，最主要整个施工过程中没有任何增项，这点必须好评！"
					},
					{
						stars1: stars[rd(1,3)-1],
						stars2: stars[rd(1,3)-1],
						stars3: stars[rd(1,3)-1],
						rooms: roomstyle[rd(1,4)-1],
						uname: "番薯用户",
						ctime: "2015/11/03",
						hpic: "../../dist/img/2_0/kf/headpic/7.jpg",
						txt: "简单快捷服务贴心，后来了解到番薯是一家刚刚成立的公司。觉得还不错，以后再有需要还会选择你家的！"
					},
					{
						stars1: stars[rd(1,3)-1],
						stars2: stars[rd(1,3)-1],
						stars3: stars[rd(1,3)-1],
						rooms: roomstyle[rd(1,4)-1],
						uname: "番薯用户",
						ctime: "2015/10/30",
						hpic: "../../dist/img/2_0/kf/headpic/8.jpg",
						txt: "实物比图片上漂亮多了，简直是大爱，质量什么的更不用说了，不管是售前或售后服务都到位！"
					},
					{
						stars1: stars[rd(1,3)-1],
						stars2: stars[rd(1,3)-1],
						stars3: stars[rd(1,3)-1],
						rooms: roomstyle[rd(1,4)-1],
						uname: "番薯用户",
						ctime: "2015/10/29",
						hpic: "../../dist/img/2_0/kf/headpic/9.jpg",
						txt: "我希望你们的产品能再丰富些，灵活些，这样我们的选择也会更大。不过你们的客服人员和施工人员都还不错"
					},
					{
						stars1: stars[rd(1,3)-1],
						stars2: stars[rd(1,3)-1],
						stars3: stars[rd(1,3)-1],
						rooms: roomstyle[rd(1,4)-1],
						uname: "番薯用户",
						ctime: "2015/10/26",
						hpic: "../../dist/img/2_0/kf/headpic/10.jpg",
						txt: "能看的出来，你们的设计和产品的内容是很用心的，我作为一名北漂人员，能再北京有个温馨的住所也是很幸福的，感谢番薯。给我带来的改变"
					},
					{
						stars1: stars[rd(1,3)-1],
						stars2: stars[rd(1,3)-1],
						stars3: stars[rd(1,3)-1],
						rooms: roomstyle[rd(1,4)-1],
						uname: "番薯用户",
						ctime: "2015/10/24",
						hpic: "../../dist/img/2_0/kf/headpic/11.jpg",
						txt: "一切都很顺利，对于效果也很满意的，施工人员嘱咐我前两天一定不要开窗户，有一些轻微的味道，我也很担心，怕对身体不好，致电了客服人员询问，客服耐心的帮我解释说用的都是环保的糯米胶，是天然环保的。我自己也去网上大量的查找，都说是正常味道，对身体没有害处的，我这下才放下心来。不过也要感谢番薯快装能给我带来这么温馨的屋子，对了 我装修的是甜橙，在这寒冷的冬天，一进家门就有一种暖暖的感觉。"
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
					},
					{
						stars1: stars[rd(1,3)-1],
						stars2: stars[rd(1,3)-1],
						stars3: stars[rd(1,3)-1],
						rooms: roomstyle[rd(1,4)-1],
						uname: "番薯用户",
						ctime: "2015/11/01",
						hpic: "../../dist/img/2_0/kf/headpic/18.jpg",
						txt: "我挑选的是海洋风格，其实我一直喜欢地中海风格，奈何是租的房屋，根本没有时间精力和金钱投入到这个上面来，因为租的房屋不值得花费大价钱去装修，但是番薯快装给了我一次改变居住环境的机会，一千多块钱就让我得到梦寐以求的居住风格。"
					},
					{
						stars1: stars[rd(1,3)-1],
						stars2: stars[rd(1,3)-1],
						stars3: stars[rd(1,3)-1],
						rooms: roomstyle[rd(1,4)-1],
						uname: "番薯用户",
						ctime: "2015/10/22",
						hpic: "../../dist/img/2_0/kf/headpic/19.jpg",
						txt: "我能说装修的师傅太好了吗，我本人是比较挑剔的人，各种细节我都是很看在眼里的，番薯的施工人员很好的帮我把家具包装好，免得弄坏弄脏，然后还有保洁来清理，很值得选择的。"
					},
					{
						stars1: stars[rd(1,3)-1],
						stars2: stars[rd(1,3)-1],
						stars3: stars[rd(1,3)-1],
						rooms: roomstyle[rd(1,4)-1],
						uname: "番薯用户",
						ctime: "2015/10/20",
						hpic: "../../dist/img/2_0/kf/headpic/20.jpg",
						txt: "效果非常满意，以后也会推荐给朋友。"
					},
					{
						stars1: stars[rd(1,3)-1],
						stars2: stars[rd(1,3)-1],
						stars3: stars[rd(1,3)-1],
						rooms: roomstyle[rd(1,4)-1],
						uname: "番薯用户",
						ctime: "2015/10/20",
						hpic: "../../dist/img/2_0/kf/headpic/21.jpg",
						txt: "旧房翻新本来就是一件让人头疼的事情，番薯做的很细致，服务也很好，避免了我很多的麻烦，对我来说真的是旧屋焕新颜。"
					},
					{
						stars1: stars[rd(1,3)-1],
						stars2: stars[rd(1,3)-1],
						stars3: stars[rd(1,3)-1],
						rooms: roomstyle[rd(1,4)-1],
						uname: "番薯用户",
						ctime: "2015/10/18",
						hpic: "../../dist/img/2_0/kf/headpic/22.jpg",
						txt: "感谢施工人员，做事情很负责，有问题及时处理，对于不懂的也认真听取意见与需求。一天完成贴装，希望你们的产品越来越多，继续加油。"
					},
					{
						stars1: stars[rd(1,3)-1],
						stars2: stars[rd(1,3)-1],
						stars3: stars[rd(1,3)-1],
						rooms: roomstyle[rd(1,4)-1],
						uname: "番薯用户",
						ctime: "2015/10/15",
						hpic: "../../dist/img/2_0/kf/headpic/23.jpg",
						txt: "现在是房子快翻完成了，中间有些小的坎坷，开始是被番薯的设计推广理念所打动，决定装修下自己的居住房屋，中间也有个小插曲，弄得很不愉快，好在客服人员积极主动的和我沟通协调，总算是把房子装修好了，要特别对客服小番提出表扬的。好在结果很不错，也算是满意的。"
					},
					{
						stars1: stars[rd(1,3)-1],
						stars2: stars[rd(1,3)-1],
						stars3: stars[rd(1,3)-1],
						rooms: roomstyle[rd(1,4)-1],
						uname: "番薯用户",
						ctime: "2015/10/14",
						hpic: "../../dist/img/2_0/kf/headpic/24.jpg",
						txt: "房屋已经测量，设计师正在做施工方案和装修效果图。家装的事与设计师一直沟通的不错，微信、QQ随时交流，好评！新家的设计要辛苦你们啦，很期待哦。"
					},
					{
						stars1: stars[rd(1,3)-1],
						stars2: stars[rd(1,3)-1],
						stars3: stars[rd(1,3)-1],
						rooms: roomstyle[rd(1,4)-1],
						uname: "番薯用户",
						ctime: "2015/10/11",
						hpic: "../../dist/img/2_0/kf/headpic/25.jpg",
						txt: "真心喜欢，很大气上档次的感觉。施工的师傅特别负责，售后也一再询问是否满意，我想说：特别满意。"
					},
					{
						stars1: stars[rd(1,3)-1],
						stars2: stars[rd(1,3)-1],
						stars3: stars[rd(1,3)-1],
						rooms: roomstyle[rd(1,4)-1],
						uname: "番薯用户",
						ctime: "2015/10/09",
						hpic: "../../dist/img/2_0/kf/headpic/26.jpg",
						txt: "质量还行，服务特别好，一切都好！"
					},
					{
						stars1: stars[rd(1,3)-1],
						stars2: stars[rd(1,3)-1],
						stars3: stars[rd(1,3)-1],
						rooms: roomstyle[rd(1,4)-1],
						uname: "番薯用户",
						ctime: "2015/10/08",
						hpic: "../../dist/img/2_0/kf/headpic/27.jpg",
						txt: "今天施工人员就上门施工，反映了问题解决的妥妥地，质量和服务都是不错的！"
					},
					{
						stars1: stars[rd(1,3)-1],
						stars2: stars[rd(1,3)-1],
						stars3: stars[rd(1,3)-1],
						rooms: roomstyle[rd(1,4)-1],
						uname: "番薯用户",
						ctime: "2015/10/05",
						hpic: "../../dist/img/2_0/kf/headpic/28.jpg",
						txt: "第一次用网络家装公司，希望你们以后在产品的搭配方面更灵活一下，一切都很顺利，现在施工进行挺快的，对施工效果很满意！"
					},
					{
						stars1: stars[rd(1,3)-1],
						stars2: stars[rd(1,3)-1],
						stars3: stars[rd(1,3)-1],
						rooms: roomstyle[rd(1,4)-1],
						uname: "番薯用户",
						ctime: "2015/10/03",
						hpic: "../../dist/img/2_0/kf/headpic/29.jpg",
						txt: "会以为家里会弄得很脏，都想要请保洁啦。但是施工现场保持的挺好，干净，施工人员的素质较高，整体服务很满意，看好你们这群小番薯们。"
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
					},
					{
						stars1: stars[rd(1,3)-1],
						stars2: stars[rd(1,3)-1],
						stars3: stars[rd(1,3)-1],
						rooms: roomstyle[rd(1,4)-1],
						uname: "番薯用户",
						ctime: "2015/11/12",
						hpic: "../../dist/img/2_0/kf/headpic/35.jpg",
						txt: "实事求是的评价，真的很好，我买东西很挑剔，但是这家的东西真的让我没得挑，产品本身就很好，再次感谢番薯客服、安装的工作人员"
					},
					{
						stars1: stars[rd(1,3)-1],
						stars2: stars[rd(1,3)-1],
						stars3: stars[rd(1,3)-1],
						rooms: roomstyle[rd(1,4)-1],
						uname: "番薯用户",
						ctime: "2015/11/07",
						hpic: "../../dist/img/2_0/kf/headpic/36.jpg",
						txt: "我家比较偏，但是番薯的售后和工程部都很负责地给我解决了，真的是一天就给快速翻新，不管是产品还是服务都是杠杠的。"
					},
					{
						stars1: stars[rd(1,3)-1],
						stars2: stars[rd(1,3)-1],
						stars3: stars[rd(1,3)-1],
						rooms: roomstyle[rd(1,4)-1],
						uname: "番薯用户",
						ctime: "2015/11/02",
						hpic: "../../dist/img/2_0/kf/headpic/37.jpg",
						txt: "开始还在犹豫，番薯的这个设计理念和施工后的效果，现在看来， 我是多虑了，品质很好的。 值得拥有的。"
					},
					{
						stars1: stars[rd(1,3)-1],
						stars2: stars[rd(1,3)-1],
						stars3: stars[rd(1,3)-1],
						rooms: roomstyle[rd(1,4)-1],
						uname: "番薯用户",
						ctime: "2015/10/26",
						hpic: "../../dist/img/2_0/kf/headpic/38.jpg",
						txt: "施工当天小番薯们来的可准时啦，他们的服务很贴心也很用心，下次要是还有需要，还会找他们合作的，赞啦啦啦、、、"
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
					},
					{
						stars1: stars[rd(1,3)-1],
						stars2: stars[rd(1,3)-1],
						stars3: stars[rd(1,3)-1],
						rooms: roomstyle[rd(1,4)-1],
						uname: "番薯用户",
						ctime: "2015/11/19",
						hpic: "../../dist/img/2_0/kf/headpic/43.jpg",
						txt: "设计师很有耐心，效果很满意，合作很愉快！客服很专业细心，特意表扬一下。"
					},
					{
						stars1: stars[rd(1,3)-1],
						stars2: stars[rd(1,3)-1],
						stars3: stars[rd(1,3)-1],
						rooms: roomstyle[rd(1,4)-1],
						uname: "番薯用户",
						ctime: "2015/11/15",
						hpic: "../../dist/img/2_0/kf/headpic/44.jpg",
						txt: "我是通过朋友介绍的，先给租住的房子简单装修下这件事我考虑很久，但是也找不到一个合适的，后来朋友给我说番薯不错，让我了解下，因为他们是做快速翻新的，而且看到效果图也觉得还不错，通过和客服沟通，了解产品后，觉得木香这种简洁大气的风格很适合我的。最后一天就搞定，让我对这家装修公司另眼相看了。"
					},
					{
						stars1: stars[rd(1,3)-1],
						stars2: stars[rd(1,3)-1],
						stars3: stars[rd(1,3)-1],
						rooms: roomstyle[rd(1,4)-1],
						uname: "番薯用户",
						ctime: "2015/11/08",
						hpic: "../../dist/img/2_0/kf/headpic/45.jpg",
						txt: "服务很到位、很专业、也很细心，平常没研究过装修的事情，但是番薯很让人放心。"
					},
					{
						stars1: stars[rd(1,3)-1],
						stars2: stars[rd(1,3)-1],
						stars3: stars[rd(1,3)-1],
						rooms: roomstyle[rd(1,4)-1],
						uname: "番薯用户",
						ctime: "2015/11/05",
						hpic: "../../dist/img/2_0/kf/headpic/46.jpg",
						txt: "把房子快翻了一下，感觉把我家整治的大了好几倍似的，太稀饭你们的产品啦 看好你们哟。"
					},
					{
						stars1: stars[rd(1,3)-1],
						stars2: stars[rd(1,3)-1],
						stars3: stars[rd(1,3)-1],
						rooms: roomstyle[rd(1,4)-1],
						uname: "番薯用户",
						ctime: "2015/11/01",
						hpic: "../../dist/img/2_0/kf/headpic/47.jpg",
						txt: "第一次用网络家装公司，番薯快装也是第一次听说。毕竟家装这种事情是很专业很传统的，整个过程下来还算满意，最初的疑虑没有了，我特地在家里盯了一天，真的没有想到施工过程这么顺利，的确很方便，简单快捷非常满意，客服也跟踪回访服务，虽然是小小的一个家，但是番薯快装很用心的在服务，满意！"
					},
					{
						stars1: stars[rd(1,3)-1],
						stars2: stars[rd(1,3)-1],
						stars3: stars[rd(1,3)-1],
						rooms: roomstyle[rd(1,4)-1],
						uname: "番薯用户",
						ctime: "2015/11/25",
						hpic: "../../dist/img/2_0/kf/headpic/48.jpg",
						txt: "服务周到细致，效果不错，各方面我都很满意，有需要还找他们家，也会推荐给朋友的！"
					},
					{
						stars1: stars[rd(1,3)-1],
						stars2: stars[rd(1,3)-1],
						stars3: stars[rd(1,3)-1],
						rooms: roomstyle[rd(1,4)-1],
						uname: "番薯用户",
						ctime: "2015/10/18",
						hpic: "../../dist/img/2_0/kf/headpic/49.jpg",
						txt: "施工现场保持的挺好，干净，施工人员的素质较高，整体服务很满意，客服也很给力，赞！"
					},
					{
						stars1: stars[rd(1,3)-1],
						stars2: stars[rd(1,3)-1],
						stars3: stars[rd(1,3)-1],
						rooms: roomstyle[rd(1,4)-1],
						uname: "番薯用户",
						ctime: "2015/10/13",
						hpic: "../../dist/img/2_0/kf/headpic/50.jpg",
						txt: "值得放心的公司，从拍下产品到施工，服务一流，设计根据我的时间要求安排施工还是件，施工的性价比很高，如果有朋友装修会推荐番薯快装的。"
					},
					{
						stars1: stars[rd(1,3)-1],
						stars2: stars[rd(1,3)-1],
						stars3: stars[rd(1,3)-1],
						rooms: roomstyle[rd(1,4)-1],
						uname: "番薯用户",
						ctime: "2015/10/11",
						hpic: "../../dist/img/2_0/kf/headpic/51.jpg",
						txt: "整体都是不错，图片的颜色和到货的颜色有些反差。售后及时跟踪解释了解情况，因为效果图是打了暖灯情况下拍，所以整体的效果更偏暖色的."
					},
					{
						stars1: stars[rd(1,3)-1],
						stars2: stars[rd(1,3)-1],
						stars3: stars[rd(1,3)-1],
						rooms: roomstyle[rd(1,4)-1],
						uname: "番薯用户",
						ctime: "2015/10/07",
						hpic: "../../dist/img/2_0/kf/headpic/52.jpg",
						txt: "体验很好，没装修前，施工人员会帮我把家具收拾好。以免弄脏弄坏，还是挺贴心的，帮我翻新了床头柜，本来还想着买一个新的，这下帮我省了一笔钱。贴心啊。"
					},
					{
						stars1: stars[rd(1,3)-1],
						stars2: stars[rd(1,3)-1],
						stars3: stars[rd(1,3)-1],
						rooms: roomstyle[rd(1,4)-1],
						uname: "番薯用户",
						ctime: "2015/10/03",
						hpic: "../../dist/img/2_0/kf/headpic/53.jpg",
						txt: "作为北漂人员，我只想简单的说，正式我需要的，精而不贵。服务周到。因为我家的窗户比较高，所以窗帘有些短，番薯帮我把窗帘修改到我满意的长度，真的是服务很很周到。"
					}
				]
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
				VM_kf.commentShow = VM_kf.commentArr[VM_kf.styleCode];
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
			if (!!_this.attr("data-wltype")) {
				VM_kf.wltype = _this.attr("data-wltype");
			}
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
			VM_kf.wltype = 1;
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
