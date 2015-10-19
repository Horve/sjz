define(['../core/core'], function(core) {
	core.onrender("redirect", function(dom) {
		var url = location.search;
		if (url) {
			var code = url.replace(/\?/,"").split("&")[0].split("=")[1];
			$.ajax({
				url: "http://www.s-jz.com/Sbuild/user/callBackGetWxOpenIdUserInfo.htm?code=" + code,
				dataType: "json",
				success: function(res) {
					var ret = res.ret;
					var uinfo = res.userInfo;
					if (ret == 2) {
						var nickName = uinfo.nickName
							, mobile = uinfo.mobile
							, head = uinfo.head
							, param = "nickName=" + nickName + "&mobile=" + mobile + "&head=" + head;
						window.location.href = "http://www.s-jz.com/html/ucenter/uedit.html?" + param;
					}
				}
			});
		} else {
			window.location = "http://www.s-jz.com";
		}
		
	});
});