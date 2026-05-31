function main(item) {
    var pid = item.id || "nmws";

    var channelMap = {
        'nmws': 262,      // 内蒙古卫视
        'nmmyws': 126,    // 内蒙古蒙古语卫视
        'nmxwzh': 127,    // 内蒙古新闻综合
        'nmjjsh': 128,    // 内蒙古经济生活
        'nmse': 129,      // 内蒙古少儿频道
        'nmwtyl': 130,    // 内蒙古文体娱乐
        'nmnm': 131,      // 内蒙古农牧频道
        'nmwh': 132,      // 内蒙古蒙古语文化
        // 地市台
        'hhht1': 141,     // 呼和浩特新闻综合
        'xlgl1': 156,     // 锡林郭勒
        'als1': 157,      // 阿拉善新闻综合
        'byle1': 158,     // 巴彦淖尔
        'erds1': 159,     // 鄂尔多斯
        'cf1': 161,       // 赤峰新闻综合
        'tl1': 163,       // 通辽新闻综合
        'wlcb1': 164,     // 乌兰察布
        'wh1': 165,       // 乌海新闻综合
        'hlbe1': 166,     // 呼伦贝尔新闻综合
        'xa1': 167,       // 兴安新闻综合
        'bt1': 168,       // 包头新闻综合
    };

    if (!(pid in channelMap)) return { error: "Invalid id: " + pid };
    var targetId = channelMap[pid];

    // ---- Base64 -> byte array ----
    function base64ToBytes(b64) {
        var map = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
        var t = {};
        for (var i = 0; i < 64; i++) t[map.charAt(i)] = i;
        b64 = b64.replace(/[\s\r\n]/g, "");
        while (b64.charAt(b64.length - 1) === "=") b64 = b64.substring(0, b64.length - 1);
        var bytes = [];
        for (var i = 0; i < b64.length; i += 4) {
            var a = t[b64.charAt(i)] || 0;
            var b = t[b64.charAt(i + 1)] || 0;
            var c = (i + 2 < b64.length) ? (t[b64.charAt(i + 2)] || 0) : 0;
            var d = (i + 3 < b64.length) ? (t[b64.charAt(i + 3)] || 0) : 0;
            bytes.push((a << 2) | (b >> 4));
            if (i + 2 < b64.length) bytes.push(((b & 0xF) << 4) | (c >> 2));
            if (i + 3 < b64.length) bytes.push(((c & 0x3) << 6) | d);
        }
        return bytes;
    }

    // ---- XXTEA decrypt ----
    function xxteaDecrypt(encBase64, keyStr) {
        var bytes = base64ToBytes(encBase64);
        if (bytes.length < 8) return "";

        while (bytes.length % 4 !== 0) bytes.push(0);
        var v = [];
        for (var i = 0; i < bytes.length; i += 4) {
            v.push(((bytes[i]) | (bytes[i + 1] << 8) | (bytes[i + 2] << 16) | (bytes[i + 3] << 24)) >>> 0);
        }

        var kb = [];
        for (var i = 0; i < keyStr.length; i++) kb.push(keyStr.charCodeAt(i));
        while (kb.length < 16) kb.push(0);
        var k = [];
        for (var i = 0; i < kb.length; i += 4) {
            k.push(((kb[i]) | (kb[i + 1] << 8) | (kb[i + 2] << 16) | (kb[i + 3] << 24)) >>> 0);
        }

        var n = v.length - 1;
        if (n < 1) return "";

        var DELTA = 0x9E3779B9;
        var rounds = 6 + Math.floor(52 / (n + 1));
        var sum = Math.imul(rounds, DELTA) >>> 0;
        var y = v[0], z;

        while (rounds > 0) {
            var e = (sum >>> 2) & 3;
            for (var p = n; p > 0; p--) {
                z = v[p - 1];
                var mx = (((z >>> 5) ^ (y << 2)) + ((y >>> 3) ^ (z << 4))) ^ ((sum ^ y) + (k[(p & 3) ^ e] ^ z));
                mx = mx >>> 0;
                y = v[p] = ((v[p] - mx) >>> 0);
            }
            z = v[n];
            var mx = (((z >>> 5) ^ (y << 2)) + ((y >>> 3) ^ (z << 4))) ^ ((sum ^ y) + (k[e] ^ z));
            mx = mx >>> 0;
            y = v[0] = ((v[0] - mx) >>> 0);
            sum = (sum - DELTA) >>> 0;
            rounds--;
        }

        var out = [];
        for (var i = 0; i < v.length; i++) {
            out.push(v[i] & 0xFF, (v[i] >>> 8) & 0xFF, (v[i] >>> 16) & 0xFF, (v[i] >>> 24) & 0xFF);
        }
        var origLen = v[v.length - 1];
        if (origLen <= 0 || origLen > out.length) origLen = out.length;

        var s = "";
        for (var i = 0; i < origLen; i++) s += String.fromCharCode(out[i]);
        try { return decodeURIComponent(escape(s)); } catch (e) { return s; }
    }

    // ---- Fetch & parse ----
    var encryptedBody = "n6wT4YYLUZiY/41vQYu5oSHD2lotdczz5ohPQw==";
    var hdrs = {
        "Referer": "https://www.nmtv.cn/",
        "Content-Type": "application/json; charset=UTF-8"
    };
    var resp = ku9.request("https://api-bt.nmtv.cn/broadcast/list", "POST", hdrs, encryptedBody, true);
    if (!resp || resp.code !== 200) return { error: "HTTP request failed" };

    var text = (resp.body || "").trim();

    // API 返回 JSON string，带外层双引号，需去掉
    if (text.charAt(0) === '"' && text.charAt(text.length - 1) === '"') {
        text = text.substring(1, text.length - 1);
    }
    // 处理转义的双引号 \"  ->  "
    text = text.replace(/\\"/g, '"');

    if (!text) return { error: "Empty response" };

    var dec = xxteaDecrypt(text, "5b28bae827e651b3");
    if (!dec) return { error: "Decryption failed" };

    var json;
    try { json = JSON.parse(dec); } catch (ex) { return { error: "JSON parse failed", preview: dec.substring(0, 300) }; }

    var list = json.data;
    if (!list) return { error: "No data field" };

    for (var i = 0; i < list.length; i++) {
        var ch = list[i].data || {};
        if (ch.id === targetId || String(ch.id) === String(targetId)) {
            if (ch.streamUrl) {
                return { url: ch.streamUrl, headers: { "Referer": "https://www.nmtv.cn/" } };
            }
        }
    }

    return { error: "Channel not found: " + pid };
}
