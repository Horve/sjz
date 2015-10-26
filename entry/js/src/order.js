define(['../core/core'], function(core) {
	var baseUrl = "http://www.s-jz.com/pub/Sbuild/";
	var OrderConfig = {};
	// 下订单
	OrderConfig.addOrderAjax = function(productId, params) {
		$.ajax({
			url: baseUrl + "orderCtrl/addOrder.htm",
			data: {"ordersStr": '{"orders": [{"productId":' + productId + ', ' + params + '}]}'},
			dataType: "json",
			success: function(res) {
				var code = res.ret
					, jumpurl = "https://open.weixin.qq.com/connect/oauth2/authorize?appid=wx4d6a2dce4f09dfd0&redirect_uri=http%3A%2F%2Fwww.s-jz.com%2Fhtml%2Fredirect.html&response_type=code&scope=snsapi_userinfo&state=STATE&connect_redirect=1#wechat_redirect";
				// 未登录
				if (code == 302) {
					// 请求微信授权接口wxf25cf835f9d71720
					// window.location.href="https://open.weixin.qq.com/connect/oauth2/authorize?appid=wx4d6a2dce4f09dfd0&redirect_uri=http%3A%2F%2Fwww.s-jz.com%2Fhtml%2Fuser&response_type=code&scope=snsapi_userinfo&state=STATE&connect_redirect=1#wechat_redirect";
					window.location.href = jumpurl;
					// wxAuth();
				} else if (code == 1) {
					// 已登录 进入购物车
					window.location.href = "http://www.s-jz.com/html/payment/";
				} else if (code == -1) {
					// 登录失败。提示重试
					alert("登录失败！");
				}
			}
		});
	};

	return OrderConfig;
});