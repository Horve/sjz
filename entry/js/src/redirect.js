define(['../core/core'], function(core) {
	core.onrender("redirect", function(dom) {
		var Tools = core.Tools;
		var url = location.search;
		var baseUrl = Tools.returnBaseUrl();
		var preUrl = localStorage.getItem("_prepage") || baseUrl + "html/user/";
		if (url) {
			var code = url.replace(/\?/,"").split("&")[0].split("=")[1];
			$.ajax({
				url: baseUrl + "user/callBackGetWxOpenIdUserInfo.htm?code=" + code,
				dataType: "json",
				success: function(res) {
					// alert(JSON.stringify(res));
					var ret = res.ret;
					var uinfo = res.userInfo;
					if (ret == 2) {
						var nickName = uinfo.nickName
							, mobile = uinfo.mobile
							, head = uinfo.head
							, param = "nickName=" + nickName + "&mobile=" + mobile + "&head=" + head;
						// window.location.href = "http://www.s-jz.com/html/ucenter/uedit.html?" + param;
						window.location.href = baseUrl + "html/ucenter/uedit.html?" + param;
					} else if (ret == 1) {
						// 登陆成功
						// window.location.href = "http://www.s-jz.com/";
						if (localStorage.getItem("_prepage")) {
							window.location.href = localStorage.getItem("_prepage");
						} else {
							window.location.href = preUrl;
						}
					}
				},
				error: function(data){
					alert(JSON.stringify(data));
				}
			});
		} else {
			window.location = preUrl;;
		}
		
	});
});