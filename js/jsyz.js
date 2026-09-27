function main(item) {
    // ---------- 频道映射 ----------
    var CHANNELS = {
        'cctv1': 177512, //CCTV1HD
        'cctv2': 177714, //CCTV2HD
        'cctv3': 177704, //CCTV3HD
        'cctv4': 177705, //CCTV4HD
        'cctv5': 177706, //CCTV5HD
        'cctv6': 177707, //CCTV6HD
        'cctv8': 177709, //CCTV8HD
        'cctv10': 177711, //CCTV10HD
        'cctv13': 177603, //CCTV13HD
        
        'bjws': 177800, //北京卫视HD
        'dfws': 177797, //东方卫视HD
        'sdws': 177805, //山东卫视HD
        'ahws': 177801, //安徽卫视x
        'hbws': 177803, //湖北卫视x
        'hnws': 177798, //湖南卫视x
        'jsws': 177796, //江苏卫视HD
        'zjws': 177799, //浙江卫视HD
        'gdws': 177802, //广东卫视HD
        'szws': 177804, //深圳卫视HD
        
        'yzxw': 235, //扬州新闻FHD
        'yzms': 291, //扬州民生HD
        'yzhj': 292, //扬州邗江HD
        'yzjd': 290, //扬州江都HD
    };

    var API_URL = 'http://vapp.96189.com/setsail/external/externalService';
    var UA = 'Mozilla/5.0 (Linux; Android 10) AppleWebKit/537.36';
    var REFERER = 'http://vapp.96189.com/';

    var id = item.id || 'cctv1';
    var type = item.t || 'hls';

    var channelId = CHANNELS[id];
    if (!channelId) return { error: '未找到频道ID: ' + id };

    // ---------- 1. 请求接口拿播放地址 ----------
    var resp = ku9.request(
        API_URL, 'POST',
        {
            'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
            'User-Agent': UA,
            'Referer': REFERER
        },
        'service=getChannelDetail&params={"channelId":"' + channelId + '"}',
        true
    );
    if (!resp) return { error: '接口返回空' };

    // ---------- 2. 解析接口返回 ----------
    var raw = resp;
    if (typeof resp === 'object') {
        if (resp.body !== undefined) raw = resp.body;
        else if (resp.data !== undefined) raw = resp.data;
    }

    var parsed = null;
    if (raw === null || raw === undefined) {
        return { error: 'body 为 null' };
    } else if (typeof raw === 'object') {
        parsed = raw;
    } else {
        var text = String(raw).trim();
        if (!text) return { error: 'body 为空' };
        if (text === 'null') return { error: 'body 为 null' };

        // 生成解析候选：原文 → 去外层引号 → 反转义 \" 或 \/
        var cands = [text];
        var hasQuote = text.charAt(0) === '"' && text.charAt(text.length - 1) === '"';
        var inner = hasQuote ? text.slice(1, -1) : text;
        if (hasQuote) cands.push(inner);
        if (inner.indexOf('\\"') >= 0) cands.push(inner.replace(/\\"/g, '"'));
        if (inner.indexOf('\\/') >= 0) cands.push(inner.replace(/\\\//g, '/'));

        for (var ci = 0; ci < cands.length; ci++) {
            try {
                var obj = JSON.parse(cands[ci]);
                if (typeof obj !== 'string') {
                    parsed = obj;
                    break;
                }
            } catch (e) {
                // 尝试下一个候选
            }
        }
        if (!parsed) {
            return { error: 'JSON 解析失败', preview: text.substring(0, 300) };
        }
    }

    var data = parsed.data || parsed.result || parsed;
    var playUrl = (data && (data.playUrl || data.playurl || data.url)) || '';
    if (!playUrl) return { error: '缺少 playUrl 字段' };

    var parts = String(playUrl).split(',');
    var flvUrl = (parts[0] || '').trim();
    var m3u8Url = (parts[1] || '').trim();

    // ---------- 3. flv 直接返回 URL ----------
    if (type === 'flv') {
        if (!flvUrl) return { error: '未取到 flv 地址' };
        return {
            url: flvUrl,
            headers: { 'Referer': REFERER, 'User-Agent': UA }
        };
    }

    // ---------- 4. hls：抓取 m3u8 内容 ----------
    if (!m3u8Url) return { error: '未取到 m3u8 地址' };

    var contentResp = ku9.request(
        m3u8Url, 'GET',
        { 'User-Agent': UA, 'Referer': REFERER },
        '',
        false
    );
    var content = String(
        (contentResp && contentResp.body) || contentResp || ''
    ).trim();

    if (!content || content.indexOf('#EXTM3U') < 0) {
        return { error: 'm3u8内容无效', preview: content.substring(0, 200) };
    }

    // ---------- 5. 把 m3u8 里的相对切片路径拼成绝对 URL ----------
    var base = m3u8Url.split('?')[0].replace(/[^/]*$/, '');
    var lines = content.split(/\r?\n/);
    var out = [];
    for (var i = 0; i < lines.length; i++) {
        var s = lines[i].trim();
        if (!s || s.charAt(0) === '#' || /^https?:\/\//i.test(s)) {
            out.push(lines[i]);
        } else {
            out.push(base + s);
        }
    }

    return out.join('\n');
}