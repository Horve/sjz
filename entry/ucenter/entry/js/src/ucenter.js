define(['../core/core', './component/dialog', './jump'], function(core, dialog, checkUsr) {
	var baseUrl = "http://www.s-jz.com/pub/Sbuild/";

	core.onrender("ucenter-index", function(dom) {
		var headBg = $('.headpic-bg', dom)
			, headPic = $('.head-pic img', dom)
			, unameEL = $('.user-info .uname', dom);
		var getUserInfo = function() {
			if (localStorage.getItem("sjz-uname")) {
				var uname = localStorage.getItem("sjz-uname")
					upic = localStorage.getItem("sjz-hdpic");
				headBg.attr("src", upic);
				headPic.attr("src", upic);
				unameEL.html(uname);	
			} else {
				$.ajax({
					url: baseUrl + "user/getUserInfo.htm",
					dataType: "json",
					success: function(res) {
						// alert(JSON.stringify(res));
						if (res.ret == 1) {
							// 获取信息成功
							// dialog.add("获取信息成功！");
							var userInfo = res.userInfo;
							headBg.attr("src", userInfo.head);
							headPic.attr("src", userInfo.head);
							unameEL.html(userInfo.nickName);
							localStorage.setItem("sjz-uname", userInfo.nickName);
							localStorage.setItem("sjz-hdpic", userInfo.head);
						} else if (res.ret == -1) {
							dialog.add("res:-1 获取信息失败！");
						} else if (res.ret == 302) {
							// 未登录
							checkUsr.doJump();
						}
					},
					error: function(res) {
						alert(JSON.stringify(res));
					}
				});
			}
		};
		getUserInfo();
	});
	core.onrender("ucenter-editinfo", function(dom) {
		var ruletxt = $('.rule-txt')
			, close = $('.close-rule')
			, cover = $('.cover')
			, ruleLink = $('.user-rule .rule-detail', dom)
			, EL_uname = $('#uname', dom)
			, EL_unick = $('#unick', dom)
			, EL_uphone = $('#uphone', dom)
			, EL_ulocate = $('#ulocate', dom)
			, EL_uaddress = $('#uaddress', dom);
		close.off('click').on('click', function() {
			ruletxt.addClass("hide");
			cover.hide();
		});
		ruleLink.off('click').on('click', function() {
			ruletxt.removeClass("hide");
			cover.show();
		});

		var paramArr = location.search.replace(/\?/, "").split("&");
		if (paramArr.length > 0 && !!paramArr[0]) {
			var params = {};
			[].forEach.call(paramArr, function(param) {
				var _arr = param.split("=");
				params[_arr[0]] = _arr[1];
			});
			var nickname = decodeURIComponent(params.nickName)
				, mobile = (params.mobile == "null" ? "" : params.mobile)
				, headpic = params.head;
			EL_unick.val(nickname);
			mobile && EL_uphone.val(mobile);
		}

		var valid = [
			["uname", /^[0-9|a-z|A-Z]{1,20}$/, "请输入0-20个由大小、写字母或数字组成的用户名"],
			["unick", /^.+$/, "请输入正确的20个字符以内的昵称"],
			["uphone", /^\d{11}$/, "请输入11位数字的手机号码"],
			["ulocate", /^.{1,20}$/, "请输入所在省份"],
			["uaddress", /^.+$/, "请输入详细住址"]
		];
		var checkDet = function() {
			var flag = true;
			for(var i = 0, n = valid.length; i < n; i++) {
				var val = $('#' + valid[i][0]).val().trim();
				if (!valid[i][1].test(val)) {
					dialog.add(valid[i][2]);
					flag = false;
					break;
				}
			}
			return flag;
		};
		$('#submit', dom).off("click").on('click', function() {
			var flag = checkDet();
			var uname = "";
			console.log(params);
			if (flag) {
				uname = EL_uname.val().trim()
					, unick = EL_unick.val().trim()
					, uphone = EL_uphone.val().trim()
					, ulocate = EL_ulocate.val().trim()
					, uaddress = EL_uaddress.val().trim()
					, params = ""
					+ "userName=" + uname
					+ "&nickName=" + unick
					+ "&mobile=" + uphone
					+ "&province=" + ulocate
					+ "&addr=" + uaddress;
				$.ajax({
					url: baseUrl + "user/register.htm?" + params,
					dataType: "json",
					success: function(res) {
						alert("res:" + JSON.stringify(res));
						// 1 成功
						// 0 失败 
						// -1失败
						// 2 用户名被占用
						// 3 用户名不能为空
						// 4 用户名长度不符合4-20
						// 7 昵称长度不符合4-20
						// 8 openId已经绑定过用户
						// 9 未得到微信授权
						// 10已注册过，返回用信息
						if (res.ret == 1) {
							window.location.href = "http://www.s-jz.com/pub/Sbuild/pay/test/html/user/";
						}
					},
					error: function(err) {
						alert("err:" + JSON.stringify(res));
					}
				});
			}
		});
	});
});
