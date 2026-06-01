function main(item) {
	// 定义频道ID映射表
	var channelMap = {
	"cczh": "36", // 长春综合
	"ccwlty": "37", // 长春文旅体育
	"ccsmsh": "38", // 长春市民生活
	"ccxwgb": "449", // 长春新闻广播
	"ccjtgb": "468", // 长春交通广播
	"ccfm880": "521", // 长春fm880
	"ccfm900": "478", // 长春fm900
	"ccfm996": "510", // 长春fm996
	"ccfm1063": "416" // 长春fm1063
	};
	
	// 获取URL参数
	var url = item.url;
	var channelId = ku9.getQuery(url, "id");

	// 如果参数是频道名称，则通过映射表转换为数字ID
	var id;
	if (channelId && channelMap[channelId]) {
		// 使用映射的频道名称
		id = channelMap[channelId];
		console.log("使用频道名称映射: " + channelId + " -> " + id);
	} else if (channelId) {
		// 直接使用数字ID
		id = channelId;
		console.log("使用数字ID: " + id);
	} else {
		// 默认值
		id = "36";
		console.log("使用默认ID: " + id);
	}

	// 构造请求URL
	var apiUrl = "https://ccms.njgdmm.com/changchun/api/api-bc/share/liveTvById?resourceId=" + id;
	console.log("请求API: " + apiUrl);

	// 发送GET请求获取直播信息
	var response = ku9.get(apiUrl, {
		'User-Agent': 'okhttp/3.12.11'
	});

	// 解析JSON响应
	var data = JSON.parse(response);

	// 检查响应状态
	if (data.error == 200 && data.data && data.data.url) {
		console.log("成功获取播放地址");
		// 返回播放地址
		return { 
			url: data.data.url,
			headers: { 'User-Agent': 'okhttp/3.12.11' }
		};
	} else {
		console.log("获取播放地址失败，错误码: " + (data.error || "未知"));
	}

	// 如果没有有效地址，返回空
	return { url: "" };
}