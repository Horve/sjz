define(['../core/core', './component/slideOptions', './component/dialog', './jump', './order'], function(core, slideOption, dialog, checkUsr, OrderConfig) {
	core.onrender("refundinfo", function(dom) {
		/*-webkit-animation: .5s detail-price-199;*/
		// 设置跳转返回目标页
		var Tools = core.Tools
		var baseUrl = Tools.returnBaseUrl();
		if (localStorage.getItem("_prepage")) {
			localStorage.removeItem("_prepage");
		}
		localStorage.setItem("_prepage", window.location.href);
		Array.prototype.delItem = function(index) {
			return this.splice(index,1);
		};
		var urlsearch = window.location.search.replace(/\?/,"")
			, searchObj = {};
		[].forEach.call(urlsearch.split("&"), function(item) {
			var _arr = item.split("=");
			console.log(_arr);
			searchObj[_arr[0]] = _arr[1];
		});
		if (!urlsearch.payid || !urlsearch.orderid) {
			window.history.back();
		}

		alert(JSON.stringify(searchObj));
		var VM_refundinfo = avalon.define({
			$id: "root",
			orderid: searchObj.orderid,
			payid: searchObj.payid,
			init: function() {
				// alert(VM_refundinfo.orderid + "---" + VM_refundinfo.payid);
				VM_refundinfo.getRefundState(VM_refundinfo.orderid, VM_refundinfo.payid);
			},
			// 查询退款状态
			getRefundState: function(oid,pid) {
				$.ajax({
					url: baseUrl + "refund/queryRefund.htm?orderId=" + oid + "&payId=" + pid,
					dataType: "json",
					success: function(res) {
						alert("000:" + JSON.stringify(res));
						if (res.ret == 1) {
							// alert(JSON.stringify(res));
						} else if (res.ret == -1) {
							dialog.add("ret:-1");
						}
					},
					error: function(res) {
						alert("111:" + JSON.stringify(res));
					}
				});
			},
			// 申请退款 oid 订单号 pid 支付号
			applyRefund: function(oid, pid) {
				$.ajax({
					url: baseUrl + "refund/applyRefund.htm?orderId=" + oid + "&payId=" + pid,
					dataType: "json",
					success: function(res) {
						// alert(JSON.stringify(res));
						if (res.ret == 1) {
							alert(JSON.stringify(res));
						} else if (res.ret == -1) {
							dialog.add("ret:-1");
						}
					},
					error: function(res) {
						alert(JSON.stringify(res));
					}
				});
			}
		});
		VM_refundinfo.init();
		avalon.scan();

	});
});