function main(item) {
    // 从地址参数中获取频道 ID，默认江苏卫视
    var id = ku9.getQuery(item.url, "id") || 'jswspro';

    // 频道映射（用于校验，非必需）
    var channels = {
        "jswspro": "江苏卫视",
        "jsws4kpro": "江苏卫视4K",
        "jscspro": "江苏城市",
        "jsxwpro": "江苏新闻",
        "jszypro": "江苏综艺",
        "jsyspro": "江苏影视",
        "jsxxpro": "江苏体育休闲",
        "jsjypro": "江苏教育",
        "jsgjpro": "江苏国际",
        "ymktpro": "优漫卡通"
    };
    if (!channels[id]) {
        return { error: '频道不存在，可用ID：' + Object.keys(channels).join(', ') };
    }

    // 硬编码密钥（取自 PHP 中的 $RAW_KEY）
    var RAW_KEY = "M3bW5PdEphbkFIa3lHdGFpZmFRRzRkV2U=NQR";
    // 提取中间部分（去掉前6位和后3位）并 Base64 解码
    var encoded = RAW_KEY.substring(6, RAW_KEY.length - 3);
    var secretKey = ku9.decodeBase64(encoded);

    // 生成签名参数（有效期 180 秒）
    var expire = Math.floor(Date.now() / 1000) + 180;
    var txTime = expire.toString(16);          // 十六进制
    var txSecret = ku9.md5(secretKey + id + txTime).toLowerCase();

    // 构造最终 m3u8 播放地址
    var baseUrl = "https://litchi-play-encrypted-site.jstv.com/applive/" 
                  + id + ".m3u8?txSecret=" + txSecret + "&txTime=" + txTime;

    // 返回播放地址并携带必要请求头（播放器将自动应用至所有分片请求）
    return {
        url: baseUrl,
        headers: {
            "Referer": "https://litchi.jstv.com/",
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.7922.170 Safari/537.36"
        }
    };
}