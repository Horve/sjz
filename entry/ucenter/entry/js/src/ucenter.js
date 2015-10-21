define(['../core/core', './component/dialog'], function(core, dialog) {
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
					url: "http://www.s-jz.com/Sbuild/user/register.htm?" + params,
					dataType: "json",
					success: function(res) {
						alert("res:" + JSON.stringify(res));
					},
					error: function(err) {
						alert("err:" + JSON.stringify(res));
					}
				});
			}
		});
	});
});
