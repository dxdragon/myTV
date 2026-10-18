function main(item) {
    // ========== 频道列表 ==========
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

    // ========== 防盗链签名有效期（核心修改点） ==========
    // 腾讯云 CDN A 型鉴权：服务端只判断 当前时间 < txTime 且 md5 校验通过。
    // 因此只要密钥正确，URL 能活多久完全由这里的偏移量决定，
    // 客户端把 txTime 往后推多久，链接就有效多久。
    // 单位：秒。默认 7 天。设得越长，长时间观看越不会因为签名过期而中断，
    // 也就不再依赖播放器的"断线重连"功能。
    // 注意：若源站对 A 型鉴权配置了最大 TTL 上限，超出会被拒（返回 403），
    //      此时把这个值调小到不超过服务端上限即可（例如 3600 / 86400）。
    var SIGN_TTL = 7 * 24 * 3600;

    // ========== 备用密钥（内置当前有效密钥）==========
    var FALLBACK_KEY = "L3DC4PN2NTcmJoaXNaZTJ0RjNOM1pHUE4=NKW";

    // ========== 动态密钥获取模块 ==========
    var __LIVE_SECRET_KEY = FALLBACK_KEY;

    (function() {
        try {
            var JS_URL = "https://live.jstv.com/assets/js/311.cfbea0d1.js";

            // 方法1: fetch API（异步，不阻塞）
            if (typeof fetch === 'function') {
                fetch(JS_URL).then(function(resp) {
                    return resp.text();
                }).then(function(text) {
                    var key = _extractKey(text);
                    if (key) __LIVE_SECRET_KEY = key;
                }).catch(function() {});
            }

            // 方法2: XMLHttpRequest 同步请求
            if (typeof XMLHttpRequest !== 'undefined') {
                try {
                    var xhr = new XMLHttpRequest();
                    xhr.open('GET', JS_URL, false);
                    xhr.send();
                    if (xhr.status === 200) {
                        var key = _extractKey(xhr.responseText);
                        if (key) __LIVE_SECRET_KEY = key;
                    }
                } catch(e) {}
            }

            // 方法3: 尝试从缓存读取
            try {
                var cached = ku9.getCache('jstv_secret_key');
                if (cached && cached.length > 20) {
                    __LIVE_SECRET_KEY = cached;
                }
            } catch(e) {}

        } catch(e) {}
    })();

    // 密钥提取函数
    function _extractKey(text) {
        try {
            var patterns = [
                'x("',
                "x('",
                'secretKey:"',
                '"secretKey":"',
                "'secretKey':'",
                'appSecret:"',
                "appSecret:'",
                '"appSecret":"',
                "'appSecret':'",
            ];
            for (var i = 0; i < patterns.length; i++) {
                var idx = text.indexOf(patterns[i]);
                if (idx !== -1) {
                    var start = idx + patterns[i].length;
                    var end = text.indexOf('"', start);
                    if (end === -1) end = text.indexOf("'", start);
                    if (end > start) {
                        var key = text.substring(start, end);
                        if (key.length > 20) {
                            try { ku9.setCache('jstv_secret_key', key, 86400000); } catch(e) {}
                            return key;
                        }
                    }
                }
            }
            var b64Match = text.match(/"[A-Za-z0-9+\/=]{20,}={0,2}"/);
            if (b64Match) {
                var candidate = b64Match[0].replace(/"/g, '');
                if (candidate.length > 20 && candidate.indexOf('/') === -1 && candidate.indexOf('+') === -1) {
                    try { ku9.setCache('jstv_secret_key', candidate, 86400000); } catch(e) {}
                    return candidate;
                }
            }
        } catch(e) {}
        return null;
    }

    // ========== 判断模式：列表模式 vs 播放模式 ==========
    var chId = ku9.getQuery(item.url, "id") || item.id || '';

    // 列表模式
    if (!chId) {
        var list = "#EXTM3U\n";
        for (var key in channels) {
            if (channels.hasOwnProperty(key)) {
                list += '#EXTINF:-1 tvg-name="' + channels[key] + '" group-title="江苏电视台",' + channels[key] + '\n';
                list += 'js://channel/jstv.js?id=' + key + '\n';
            }
        }
        return list;
    }

    // ========== 播放模式 ==========
    if (!channels[chId]) {
        return { error: '频道不存在，可用ID：' + Object.keys(channels).join(', ') };
    }

    var secretKeyRaw = __LIVE_SECRET_KEY;

    // 提取中间部分（去掉前6位和后3位）并 Base64 解码
    var encoded = secretKeyRaw.substring(6, secretKeyRaw.length - 3);
    var secretKey = ku9.decodeBase64(encoded);

    if (!secretKey) {
        return { error: '密钥解码失败，请检查密钥是否有效' };
    }

    // 生成签名参数（有效期由 SIGN_TTL 控制，默认 7 天）
    var expire = Math.floor(Date.now() / 1000) + SIGN_TTL;
    var txTime = expire.toString(16);          // 十六进制
    var txSecret = ku9.md5(secretKey + chId + txTime).toLowerCase();

    // 构造最终 m3u8 播放地址
    var baseUrl = "https://litchi-play-encrypted-site.jstv.com/applive/"
                  + chId + ".m3u8?txSecret=" + txSecret + "&txTime=" + txTime;

    return {
        url: baseUrl,
        headers: {
            "Referer": "https://litchi.jstv.com/",
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.7922.170 Safari/537.36"
        }
    };
}
