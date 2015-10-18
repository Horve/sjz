define(['../../core/core'], function(core) {
	var isfirst = true;
	var isChoose = false;
	var allData = [];
	var slideOption = {
		TEMPLATE: '<div class="form-mask"></div><div class="form-slide"><header class="sli-title"><span>选项</span><em class="slide-cancel">取消</em></header><ul class="slide-item-ul"><li class="on"><span>200-300</span><i></i></li></ul></div>',
		// {
		// 	title: "这是标题这是标题",
		// 	data: ["选项一","选项二","选项三","选项四","选项五","选项六"],
		//  choose: false,
		// 	callback: function() {
		// 	}
		// }
		add: function(elem, options) {
			console.log("Enter slideOption Component!");
			var _this = this;
			isChoose = options.choose || false;
			if (options.initOption && typeof options.initOption === 'function') {
				options.initOption(elem, options.data);
			}
			$(elem).off("click").on("click", function() {
				allData = options.data;
				_this.beforeShow(elem, options);
			});
		},
		beforeShow: function(elem, options, callback) {
			var _this = this;
			var title = options.title;
			var data = options.data;
			var slide;
			if (!$('.form-mask').length) {
				slide = $(_this.TEMPLATE);
				isfirst = true;
			} else {
				slide = $('.form-mask, .form-slide');
				isfirst = false;
			}
			slide.find('.sli-title span').html(title);
			var content = [];
			[].forEach.call(data, function(item) {
				content.push('<li data-id="' + item.id + '"><span>' + item.txt + '</span><i></i></li>');
			});
			slide.find('.slide-item-ul').html(content.join(""));
			if (isfirst) {
				$('body').append(slide);
				setTimeout(function() {
					_this.show($('.form-slide'), _this, elem, options.callback);
				}, 100);
			} else {
				// _this.show($('.form-slide'), _this, elem, options.callback);
				$('.form-slide, .form-mask').show();
				_this.show($('.form-slide'), _this, elem, options.callback);
			}
		},

		show: function(el, _this, pageElem, callback) {
			var elH = $(el).height();
			$(el).attr("style", "-webkit-transform: translate3d(0,0,0) translateY(-" + elH + "px);");
			_this.hideBind(el);
			if (isChoose) {
				_this.itemEvent(el, pageElem, callback);
			}
		},
		hide: function(el) {
			// $(el).removeClass("anim");
			$(el).attr("style", "-webkit-transform: translate3d(0,0,0);");
			$('.form-mask').hide();
			this.afterHide();
		},
		hideBind: function(el) {
			var _this = this;
			$('.form-mask, .slide-cancel').off('click').on('click', function() {
				_this.hide(el);
			});
		},
		afterHide: function() {
			setTimeout(function() {
				$('.form-slide').hide();
			}, 300);
		},
		itemEvent: function(el, pageElem, callback) {
			var _this = this;
			var lis = $('.form-slide li');
			var input = $(pageElem).find('input');
			if($(input).attr('data-id')){
				[].forEach.call(lis, function(li) {
					if ($(li).attr("data-id") === $(input).attr('data-id')) {
						$(li).addClass("on");
					}	
				});
			}

			$('.form-slide li').off('click').on('click', function() {
				var index = $(this).index();
				if(callback && typeof callback === "function") {
					callback(allData[index]);
				}
				$(this).addClass("on").siblings().removeClass("on");
				setTimeout(function() {
					_this.hide(el);
				}, 300);
				
			});
		}
		
	};

	return slideOption;
});