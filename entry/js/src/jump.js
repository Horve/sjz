define(function() {
	var baseUrl = "http://www.s-jz.com/test/Sbuild/"
		, redirect = encodeURIComponent(baseUrl + "html/redirect.html")
		, jumpurl = "https://open.weixin.qq.com/connect/oauth2/authorize?appid=wx4d6a2dce4f09dfd0&redirect_uri=" + redirect + "&response_type=code&scope=snsapi_userinfo&state=STATE&connect_redirect=1#wechat_redirect"
		, shopChartUrl = baseUrl + "html/payment/"
		, checkUsr = {};

	checkUsr.doJump = function() {
		window.location.href = jumpurl;
	};
	checkUsr.toShopChart = function() {
		window.location.href = shopChartUrl;
	};
	checkUsr.toIndex = function() {
		window.location.href = baseUrl + "html/user/";
	};
	checkUsr.toUserInfo = function() {
		window.location.href = baseUrl + "html/ucenter/uinfo.html";
	};
	return checkUsr;
});