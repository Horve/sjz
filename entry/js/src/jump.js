define(function() {
	var baseUrl = "http://www.s-jz.com/pub/Sbuild/"
		, jumpurl = "https://open.weixin.qq.com/connect/oauth2/authorize?appid=wx4d6a2dce4f09dfd0&redirect_uri=http%3A%2F%2Fwww.s-jz.com%2Fpub%2FSbuild%2Fpay%2Ftest%2Fhtml%2Fredirect.html&response_type=code&scope=snsapi_userinfo&state=STATE&connect_redirect=1#wechat_redirect"
		, shopChartUrl = baseUrl + "pay/test/html/payment/"
		, checkUsr = {};

	checkUsr.doJump = function() {
		window.location.href = jumpurl;
	};
	checkUsr.toShopChart = function() {
		window.location.href = shopChartUrl;
	};
	return checkUsr;
});