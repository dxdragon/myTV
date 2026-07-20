function main(item) {
    // 1. 尝试从缓存获取 (有效期 600秒 = 600000毫秒)
    const cacheKey = "cwjdHD_cache_v2";
    try {
        let cachedUrl = ku9.getCache(cacheKey);
        if (cachedUrl && cachedUrl.indexOf("http") === 0) {
            return { url: cachedUrl };
        }
    } catch (e) {
        // 忽略缓存读取错误
    }

    // --- 工具函数：获取通用请求头 ---
    function getCommonHeaders() {
        let ts = new Date().getTime().toString();
        let deviceId = ku9.md5(ts);
        return {
            'User-Agent': 'okhttp/3.14.9',
            'charset': 'UTF-8',
            'channelId': 'cbn',
            'deviceType': '2048',
            'releaseVersion': '2.0.4',
            'releaseVersionCode': '204',
            'os': 'Android',
            'deviceId': deviceId,
            'API-VERSION': '2',
            'Accept': '*/*',
            'Connection': 'keep-alive'
        };
    }

    // --- 工具函数：生成签名 ---
    function generateSign(input, flag) {
        let ts = Math.floor(new Date().getTime() / 1000);
        let charset = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
        
        // 随机字符串逻辑
        let randLen = Math.floor(Math.random() * 4) + 4; 
        let randStr = '';
        for (let i = 0; i < randLen; i++) {
            randStr += charset.charAt(Math.floor(Math.random() * charset.length));
        }

        let suffix = flag ? '01234ibcp9' : '0123456789';
        let s1 = input + "-" + ts + "-" + randStr + "-" + suffix;
        let hexMd5 = ku9.md5(s1);

        return ts + "-" + randStr + "-" + hexMd5;
    }

    // --- 第一步：请求授权接口 ---
    let firstPath = '/v1/resourceProductRightsAuth';
    let firstSign = generateSign(firstPath, true);
    
    let headers1 = getCommonHeaders();
    headers1['sign'] = firstSign;
    headers1['Host'] = 'saleservice.5gtv.com.cn';
    headers1['Content-Type'] = 'application/json';

    let body1 = JSON.stringify({
        "resId": "30167",
        "resourceStreamId": "30167"
    });

    let res1 = ku9.request('https://saleservice.5gtv.com.cn' + firstPath, "POST", headers1, body1);
    
    // 安全性检查
    if (!res1 || !res1.body) return { url: "Step1 Request Failed" };
    
    let json1;
    try {
        json1 = JSON.parse(res1.body);
    } catch (e) {
        return { url: "Step1 JSON Parse Error" };
    }

    if (!json1.data || !json1.data.url) return { url: "Step1 Data Empty" };

    let firstUrl = json1.data.url + '&t=1&v=204';

    // --- 第二步：解析 URI 并请求最终地址 ---
    // 兼容性处理：如果 ku9.Uri 报错，使用正则手动截取 Path + Query
    let uriForSign = "";
    try {
        // 尝试使用内置方法
        let uriInfo = ku9.Uri(firstUrl);
        uriForSign = uriInfo.Path + (uriInfo.Query ? (uriInfo.Query.indexOf("?") === 0 ? "" : "?") + uriInfo.Query : "");
    } catch (e) {
        // 如果内置方法报错，使用正则
        let match = firstUrl.match(/https?:\/\/[^\/]+(\/[^#]*)/);
        uriForSign = match ? match[1] : firstUrl;
    }
    
    let secondSign = generateSign(uriForSign, true);
    let headers2 = getCommonHeaders();
    headers2['sign'] = secondSign;
    headers2['Host'] = 'live-dispatcher.5gtv.com.cn';

    let res2 = ku9.request(firstUrl, "GET", headers2);
    
    if (!res2 || !res2.body) return { url: "Step2 Request Failed" };
    
    let json2;
    try {
        json2 = JSON.parse(res2.body);
    } catch (e) {
        return { url: "Step2 JSON Parse Error" };
    }

    if (!json2.data || !json2.data.url) return { url: "Step2 Data Empty" };
    
    let playUrl = json2.data.url;

    // 3. 写入缓存
    try {
        ku9.setCache(cacheKey, playUrl, 600000);
    } catch (e) {}

    return { url: playUrl };
}