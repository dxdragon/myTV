/**
 * 香港卫视（hkstv.tv）—— 酷9 JS 播放脚本
 * 文件位置：ku9/js/hkstv.js
 *
 * 列表写法（二选一）：
 *   香港卫视,js://hkstv.js?id=hkstv
 *   香港卫视,http://你的域名/ku9/js/hkstv.js?id=hkstv
 *
 * 取流链路（官方接口，实测有效）：
 *   1) https://hkstv.tv/services/live/default
 *        -> {"data":{"id":12,"sourceid":"mutfysrq","channel":"香港卫视"}}
 *   2) https://hkstv.tv/lives/api/player/<sourceid>?mode=live&protocal=hls
 *        -> {"livetime":"...","url":"http://webcast.hkstv.tv/livestream/<id>/playlist.m3u8"}
 *
 * 说明：
 *   - id 参数可传 hkstv（默认），也可直接传 sourceid 用于指定线路；
 *   - 官方接口偶发返回 webproxylive 反代地址，此处统一还原为官方域名并升级 https；
 *   - 取流失败时降级为 WebView 打开官网直播页。
 */

function main(item) {
    var UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/158.0.8127.38 Safari/537.36";
    var apiHeaders = { "User-Agent": UA, "Referer": "https://hkstv.tv/live", "Accept": "application/json" };
    var playHeaders = { "User-Agent": UA, "Referer": "https://hkstv.tv/live", "Accept": "*/*" };
    var hdrStyle = 0; // 记录酷9 ku9.get 请求头参数风格：1=直接传对象 2=包 {headers:...}

    /* id 参数：hkstv（默认）或直接传 sourceid */
    var id = "";
    try { id = (item && item.id) ? String(item.id) : ""; } catch (e) {}

    /* 兼容不同版本酷9对 ku9.get 第二参数的处理方式 */
    function tvGet(url, h) {
        function raw(arg) {
            try {
                var r = ku9.get(url, arg);
                return typeof r === "string" ? r : "";
            } catch (e) { return ""; }
        }
        var r = "";
        if (hdrStyle !== 2) {
            r = raw(JSON.stringify(h));
            if (r) { hdrStyle = 1; return r; }
        }
        if (hdrStyle !== 1) {
            r = raw(JSON.stringify({ headers: h }));
            if (r) { hdrStyle = 2; return r; }
        }
        return "";
    }

    /* 1. 取 sourceid（调用方显式指定时直接使用） */
    var sid = (id && id !== "hkstv") ? id : "";
    if (!sid) {
        try {
            var d = JSON.parse(tvGet("https://hkstv.tv/services/live/default", apiHeaders) || "{}");
            if (d && d.data) sid = d.data.sourceid || "";
        } catch (e) {}
        if (!sid) sid = "mutfysrq";
    }

    /* 2. 取播放地址 */
    var u = "";
    try {
        var p = JSON.parse(tvGet("https://hkstv.tv/lives/api/player/" + sid + "?mode=live&protocal=hls", apiHeaders) || "{}");
        if (p && p.url) u = p.url;
    } catch (e) {}

    /* 3. 地址规整：http->https；还原 webproxylive 反代域名 */
    if (u) {
        u = u.replace(/^http:\/\//i, "https://").replace(/https?:\/\/webproxylive/i, "https://hkstv.tv");
    }

    /* 4. 有 m3u8 直接播；否则降级 WebView 官网直播页 */
    if (u && u.indexOf(".m3u8") >= 0) {
        return JSON.stringify({ url: u, headers: playHeaders, player: 0 });
    }
    return JSON.stringify({
        webview: "https://hkstv.tv/live",
        headers: { "User-Agent": UA }
    });
}
