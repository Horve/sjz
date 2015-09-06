define(['../../core/core'], function($) {
	
	var isfirst = true;
	var slideOption = {
		TEMPLATE: '<div class="form-mask"></div><div class="form-slide"><header class="sli-title"><span>选项</span></header><ul class="slide-item-ul"><li class="on"><span>200-300</span><i>√</i></li></ul></div>',
		// {
		// 	title: "这是标题这是标题",
		// 	data: ["选项一","选项二","选项三","选项四","选项五","选项六"],
		// 	callback: function() {

		// 	}
		// }
		add: function(elem, options) {
			var _this = this;
			$(elem).off("click").on("click", function() {
				_this.beforeShow(elem, options);
			});
		},
		beforeShow: function(elem, options, callback) {
			var _this = this;
			var title = options.title;
			var data = options.data;
			var slide;
			console.log($('.form-mask').length);
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
				content.push('<li data-id="' + item.id + '"><span>' + item.txt + '</span><i>√</i></li>');
			});
			slide.find('.slide-item-ul').html(content.join(""));
			if (isfirst) {
				$('.page').append(slide);
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
			console.log(el);
			var elH = $(el).height();
			$(el).attr("style", "-webkit-transform: translate3d(0,0,0) translateY(-" + elH + "px);");
			_this.hideBind(el);
			_this.itemEvent(el, pageElem, callback);
		},
		hide: function(el) {
			// $(el).removeClass("anim");
			$(el).attr("style", "-webkit-transform: translate3d(0,0,0);");
			$('.form-mask').hide();
			this.afterHide();
		},
		hideBind: function(el) {
			var _this = this;
			$('.form-mask').off('click').on('click', function() {
				_this.hide(el);
			});
		},
		afterHide: function() {
			setTimeout(function() {
				$('.form-slide').hide();
			}, 500);
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
				if(callback && typeof callback === "function") {
					callback({
						id: $(this).attr("data-id"),
						txt: $(this).find('span').html()
					});
				}
				$(this).addClass("on").siblings().removeClass("on");
				_this.hide(el);
			});
			
		}
		
	};

	return slideOption;
});