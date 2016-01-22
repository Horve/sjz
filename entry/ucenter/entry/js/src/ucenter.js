define(['../core/core', './component/dialog', './jump'], function(core, dialog, checkUsr) {
	var baseUrl = "http://www.s-jz.com/pub/Sbuild/";

	core.onrender("ucenter-index", function(dom) {
		var headBg = $('.headpic-bg', dom)
			, headPic = $('.head-pic img', dom)
			, unameEL = $('.user-info .uname', dom);
		var getUserInfo = function() {
			if (localStorage.length >= 7) {
				var unkname = localStorage.getItem("sjz-unkname")
					, uid = localStorage.getItem("sjz-uid")
					, upic = localStorage.getItem("sjz-hdpic")
					, uname = localStorage.getItem("sjz-uname")
					, uphone = localStorage.getItem("sjz-uphone")
					, ucountry = localStorage.getItem("sjz-ucountry")
					, uprovince = localStorage.getItem("sjz-uprovince")
					, uaddr = localStorage.getItem("sjz-uaddr");
				headBg.attr("src", upic);
				headPic.attr("src", upic);
				unameEL.html(unkname);	
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
							localStorage.setItem("sjz-uid", userInfo.userId);
							localStorage.setItem("sjz-unkname", userInfo.nickName);
							localStorage.setItem("sjz-hdpic", userInfo.head);
							localStorage.setItem("sjz-uname", userInfo.userName);
							localStorage.setItem("sjz-uphone", userInfo.mobile);
							localStorage.setItem("sjz-ucountry", userInfo.country);
							localStorage.setItem("sjz-uprovince", userInfo.province);
							localStorage.setItem("sjz-uaddr", userInfo.addr);
						} else if (res.ret == -1) {
							dialog.add("res:-1 获取信息失败，请重试！");
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
	// 查看资料
	core.onrender("ucenter-info", function(dom) {
		var headBg = $('.headpic-bg', dom)
			, headPic = $('.head-pic img', dom)
			, uidEL = $('.user-info .uname em', dom)
			, unickEL = $('.show-unick', dom)
			, unameEL = $('.show-name', dom)
			, umobileEL = $('.show-mobile', dom)
			, uprovinceEL = $('.show-province', dom)
			, uaddrEL = $('.show-addr', dom);
		var getUserInfo = function() {
			if (localStorage.length >= 7) {
				var unkname = localStorage.getItem("sjz-unkname")
					, uid = localStorage.getItem("sjz-uid")
					, upic = localStorage.getItem("sjz-hdpic")
					, uname = localStorage.getItem("sjz-uname")
					, uphone = localStorage.getItem("sjz-uphone")
					, ucountry = localStorage.getItem("sjz-ucountry")
					, uprovince = localStorage.getItem("sjz-uprovince")
					, uaddr = localStorage.getItem("sjz-uaddr");
				headBg.attr("src", upic);
				headPic.attr("src", upic);
				uidEL.html(uid);
				unickEL.html(unkname);
				unameEL.html(uname);
				umobileEL.html(uphone);
				uprovinceEL.html(uprovince);
				uaddrEL.html(uaddr);
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
							uidEL.html(userInfo.userId);
							unickEL.html(userInfo.nickName);
							unameEL.html(userInfo.userName);
							umobileEL.html(userInfo.mobile);
							uprovince.html(userInfo.province);
							uaddrEL.html(userInfo.addr);

							localStorage.setItem("sjz-uid", userInfo.userId);
							localStorage.setItem("sjz-unkname", userInfo.nickName);
							localStorage.setItem("sjz-hdpic", userInfo.head);
							localStorage.setItem("sjz-uname", userInfo.userName);
							localStorage.setItem("sjz-uphone", userInfo.mobile);
							localStorage.setItem("sjz-ucountry", userInfo.country);
							localStorage.setItem("sjz-uprovince", userInfo.province);
							localStorage.setItem("sjz-uaddr", userInfo.addr);
						} else if (res.ret == -1) {
							dialog.add("res:-1 获取信息失败，请重试！");
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
			, EL_uaddress = $('#uaddress', dom)
			, EL_checkbox = $('.user-rule .checkbox', dom)
			, operaType = 1; // 1 绑定 2 编辑
		EL_checkbox.off('click').on('click', function() {
			if (!$(this).hasClass('on')) {
				$(this).addClass('on');
			} else {
				$(this).removeClass('on');
			}
		});
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
			// 绑定
			operaType = 1;
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
		} else {
			if (/\#\!_edit/.test(location.href)) {
				// 编辑
				operaType = 2
				$('.user-rule', dom).hide(); // 隐藏协议
				if (localStorage.length >= 7) {
					var unkname = localStorage.getItem("sjz-unkname")
						, uid = localStorage.getItem("sjz-uid")
						, upic = localStorage.getItem("sjz-hdpic")
						, uname = localStorage.getItem("sjz-uname")
						, uphone = localStorage.getItem("sjz-uphone")
						, ucountry = localStorage.getItem("sjz-ucountry")
						, uprovince = localStorage.getItem("sjz-uprovince")
						, uaddr = localStorage.getItem("sjz-uaddr");
					EL_uname.val(uname);
					EL_unick.val(unkname);
					EL_uphone.val(uphone);
					EL_ulocate.val(uprovince);
					EL_uaddress.val(uaddr);
				} else {
					$.ajax({
						url: baseUrl + "user/getUserInfo.htm",
						dataType: "json",
						success: function(res) {
							// alert(JSON.stringify(res));
							if (res.ret == 1) {
								// 获取信息成功
								var userInfo = res.userInfo;
								EL_uname.val(userInfo.userName);
								EL_unick.val(userInfo.nickName);
								EL_uphone.val(userInfo.mobile);
								EL_ulocate.val(userInfo.province);
								EL_uaddress.val(userInfo.addr);
								localStorage.setItem("sjz-uid", userInfo.userId);
								localStorage.setItem("sjz-unkname", userInfo.nickName);
								localStorage.setItem("sjz-hdpic", userInfo.head);
								localStorage.setItem("sjz-uname", userInfo.userName);
								localStorage.setItem("sjz-uphone", userInfo.mobile);
								localStorage.setItem("sjz-ucountry", userInfo.country);
								localStorage.setItem("sjz-uprovince", userInfo.province);
								localStorage.setItem("sjz-uaddr", userInfo.addr);

							} else if (res.ret == -1) {
								dialog.add("res:-1 获取信息失败，请重试！");
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
			}
		}

		var valid = [
			["uname", /^[\u4E00-\u9FA5]{2,20}$/, "请输入2-20汉字以内的姓名"],
			["unick", /^.+$/, "请输入20个字符以内的昵称"],
			["uphone", /^\d{11}$/, "请输入11位数字的手机号码"],
			["ulocate", /^.{1,20}$/, "请选择所在省份"],
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
			if (flag) {
				if (operaType == 1) {
					// 绑定
					if (EL_checkbox.hasClass('on')) {
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
								// alert("res:" + JSON.stringify(res));
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
									// checkUsr.toIndex();
									if (localStorage.getItem("_prepage")) {
										window.location.href = localStorage.getItem("_prepage");
									} else {
										window.location.href = baseUrl + "html/user/";
									}
								} else if (res.ret == -1 || res.ret == 0) {
									dialog.add("用户绑定失败！请重试！");
								} else if (res.ret == 8) {
									dialog.add("当前openID已经绑定过用户！");
								} else if (res.ret == 9) {
									dialog.add("未得到微信授权，请重试！");
								} else if (res.ret == 10) {
									dialog.add("已经注册过！");
								}
							},
							error: function(err) {
								alert("err:" + JSON.stringify(res));
							}
						});
					} else {
						dialog.add("您还没同意《S+互联网家装用户服务协议》");					
					}
				} else if (operaType == 2) {
					// 编辑
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
						url: baseUrl + "user/editUserInfo.htm?" + params,
						dataType: "json",
						success: function(res) {
							// alert("res:" + JSON.stringify(res));
							// 1 成功
							// -1 失败
							// 7 昵称长度不符合4-20
							// 302 未登录
							if (res.ret == 1) {
								var userInfo = res.userInfo;
								// localStorage.clear();
								localStorage.setItem("sjz-uid", userInfo.userId);
								localStorage.setItem("sjz-unkname", userInfo.nickName);
								localStorage.setItem("sjz-hdpic", userInfo.head);
								localStorage.setItem("sjz-uname", userInfo.userName);
								localStorage.setItem("sjz-uphone", userInfo.mobile);
								localStorage.setItem("sjz-ucountry", userInfo.country);
								localStorage.setItem("sjz-uprovince", userInfo.province);
								localStorage.setItem("sjz-uaddr", userInfo.addr);
								checkUsr.toUserInfo();
							} else if (res.ret == -1) {
								dialog.add("修改用户信息失败！请重试！");
							} else if (res.ret == 302) {
								checkUsr.doJump(); // 未登录
							}
						},
						error: function(err) {
							alert("err:" + JSON.stringify(res));
						}
					});
				}
			}
		});
	});
});
