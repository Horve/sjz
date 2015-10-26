define(['../core/core'], function(core) {
	core.onrender("redirect", function(dom) {
		var url = location.search;
		var baseUrl = "http://www.s-jz.com/pub/Sbuild/";
		if (url) {
			var code = url.replace(/\?/,"").split("&")[0].split("=")[1];
			$.ajax({
				url: baseUrl + "user/callBackGetWxOpenIdUserInfo.htm?code=" + code,
				dataType: "json",
				success: function(res) {
					alert(JSON.stringify(res));
					var ret = res.ret;
					var uinfo = res.userInfo;
					if (ret == 2) {
						var nickName = uinfo.nickName
							, mobile = uinfo.mobile
							, head = uinfo.head
							, param = "nickName=" + nickName + "&mobile=" + mobile + "&head=" + head;
						// window.location.href = "http://www.s-jz.com/html/ucenter/uedit.html?" + param;
						window.location.href = "http://www.s-jz.com/pub/Sbuild/pay/test/html/ucenter/uedit.html?" + param;
					} else if (ret == 1) {
						// 登陆成功
						// window.location.href = "http://www.s-jz.com/";
						window.history.go(-1);
					}
				},
				error: function(data){
					alert(JSON.stringify(data));
				}
			});
		} else {
			window.location = "http://www.s-jz.com";
		}
		
	});
});