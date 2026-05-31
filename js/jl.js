function main(item) {
    var channelId = item.id;
    if (!channelId) return { error: "Missing 'id' parameter" };

    var channelMap = {
        'jlws': 2,      // 吉林卫视
        'jlds': 3,      // 吉林都市
        'jlsh': 4,      // 吉林生活
        'jlys': 5,      // 吉林影视
        'jlxc': 6,      // 吉林乡村
        'jlzywh': 8,    // 吉林综艺·文化
        'ybws': 22,     // 延边卫视
        'cczh': 31,     // 长春综合
        'jlszh': 23,    // 吉林市新闻综合
        'spzh': 24,     // 四平新闻综合
        'lyzh': 25,     // 辽源新闻综合
        'thzh': 26,     // 通化新闻综合
        'bszh': 29,     // 白山新闻综合
        'bczh': 27,     // 白城新闻综合
        'syzh': 28,     // 松原新闻综合
    };

    if (!(channelId in channelMap)) return { error: "Invalid channel id: " + channelId };
    var targetId = channelMap[channelId];

    // ---- Base64 -> byte array (不依赖 ku9.decodeBase64) ----
    function base64ToBytes(b64) {
        var map = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
        var t = {};
        for (var i = 0; i < 64; i++) t[map.charAt(i)] = i;
        b64 = b64.replace(/[\s\r\n=]/g, "");
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

        // bytes -> uint32 (little-endian)
        var v = [];
        for (var i = 0; i + 3 < bytes.length; i += 4) {
            v.push(((bytes[i]) | (bytes[i + 1] << 8) | (bytes[i + 2] << 16) | (bytes[i + 3] << 24)) >>> 0);
        }

        // key -> uint32
        var kb = [];
        for (var i = 0; i < keyStr.length; i++) kb.push(keyStr.charCodeAt(i));
        while (kb.length < 16) kb.push(0);
        var k = [];
        for (var i = 0; i + 3 < kb.length; i += 4) {
            k.push(((kb[i]) | (kb[i + 1] << 8) | (kb[i + 2] << 16) | (kb[i + 3] << 24)) >>> 0);
        }
        while (k.length < 4) k.push(0);

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

        // uint32 -> bytes
        var out = [];
        for (var i = 0; i < v.length; i++) {
            out.push(v[i] & 0xFF, (v[i] >>> 8) & 0xFF, (v[i] >>> 16) & 0xFF, (v[i] >>> 24) & 0xFF);
        }
        var origLen = v[v.length - 1];
        if (origLen < 0 || origLen > out.length) origLen = out.length;

        // bytes -> UTF-8 string
        var s = "";
        for (var i = 0; i < origLen; i++) s += String.fromCharCode(out[i]);
        try { return decodeURIComponent(escape(s)); } catch (e) { return s; }
    }

    // ---- Fetch & parse ----
    var url = "https://clientapi.jlntv.cn/broadcast/list?page=1&size=10000&type=1";
    var resp = ku9.request(url, "GET", { "User-Agent": "Mozilla/5.0 (Windows NT 6.1)" }, null, false);
    if (!resp || resp.code !== 200) return { error: "HTTP request failed" };

    var text = (resp.body || "").trim();
    if (text.charAt(0) === '"' && text.charAt(text.length - 1) === '"') {
        text = text.substring(1, text.length - 1);
    }

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
                return { url: ch.streamUrl, headers: { "User-Agent": "Mozilla/5.0 (Windows NT 6.1)" } };
            }
        }
    }

    return { error: "Channel not found: " + channelId };
}
