// 酷9 JS 脚本：九江电视台直播源
// 用法：js://jxjj.js?id=1  （id支持: jjxwzh, jjgg, jjjy 或数字 1,2,3）
// 可选参数：force=1 强制刷新缓存；debug=1 输出调试信息到日志

function main(item) {
    // 常量定义
    const API_URL = 'https://appi.jxrmdn.cn/api/quklive/generateTempPlayUrl';
    const X_SESSION = '6ab4f607a6e4810019f88816';
    const X_TENANT = '314';
    const X_TOKEN = 'MDAwMDAwMDAtNjJkNy1kMzA2LTAwMDAtMDAwMDcyMzIwZDQw';
    const USER_AGENT = '5.3.5;00000000-62d7-d306-0000-000072320d40;HUAWEI ALN-AL80;Android;12;Release;7.0.0';
    const MINUTES = 30;
    const CACHE_TTL_MS = 1500 * 1000; // 25 分钟

    // 频道签名数据（失效后请更新此处）
    const CHANNELS = {
        'jjxwzh': {
            activityId: '1768529286203024',
            ts: '1790244487051',
            rid: '8629e6ef-6121-44f0-bffe-8976211ac62e',
            sig: 'cfde8d00ef67fa96f03bf11aba7a648181dfb004f28a4bea19d60b14786b5e3b'
        },
        'jjgg': {
            activityId: '1776821035295363',
            ts: '1790244480405',
            rid: 'a6600547-60b1-4f2a-85ee-e66021af95f3',
            sig: '8dd002cc3c8b9b0f36dccc18d1c1d6698a0167a75af905807dc0fc9dba2c9435'
        },
        'jjjy': {
            activityId: '1776821070594049',
            ts: '1790244483237',
            rid: 'a9cd6b42-f32e-4d96-ba3e-fe71b19c36bf',
            sig: 'd6ce0fae820fa2bd5888269e20b01c7c855164dd7540ec650ca1188d8b62bdf4'
        }
    };

    // 数字 id 兼容映射
    const ALIAS = { '1': 'jjxwzh', '2': 'jjgg', '3': 'jjjy' };

    let id = String(item.id || 'jjxwzh');
    if (ALIAS[id]) {
        id = ALIAS[id];
    }

    if (!CHANNELS[id]) {
        console.log('ERROR: id 无效，支持: jjxwzh, jjgg, jjjy 或数字 1,2,3');
        return { url: 'http://error/jiujiang?msg=' + encodeURIComponent('id 无效: ' + id) };
    }

    let cfg = Object.assign({}, CHANNELS[id]);
    // URL 参数可覆盖签名（便于调试）
    if (item.ts) cfg.ts = item.ts;
    if (item.rid) cfg.rid = item.rid;
    if (item.sig) cfg.sig = item.sig;

    const cacheKey = 'jiujiang_' + id;
    let url = null;
    let debugInfo = {
        id: id,
        activityId: cfg.activityId,
        timestamp: cfg.ts,
        source: 'cache'
    };

    // 1) 缓存优先（除非 force=1）
    if (!item.force) {
        url = ku9.getCache(cacheKey);
    }

    // 2) 缓存未命中，请求接口
    if (!url) {
        debugInfo.source = 'api';
        const api = API_URL + '?activityId=' + encodeURIComponent(cfg.activityId) + '&minutes=' + MINUTES;

        const headers = {
            'X-SESSION-ID': X_SESSION,
            'X-REQUEST-ID': cfg.rid,
            'X-TIMESTAMP': cfg.ts,
            'X-SIGNATURE': cfg.sig,
            'X-TENANT-ID': X_TENANT,
            'token': X_TOKEN,
            'Cache-Control': 'no-cache',
            'Accept': '*/*',
            'User-Agent': USER_AGENT
        };

        let res = ku9.request(api, 'GET', headers, null, false);
        debugInfo.httpCode = res.code;
        debugInfo.raw = res.body;

        if (res.code < 200 || res.code >= 300) {
            let msg = '接口返回异常，多半是签名已过期，请重新抓包更新 CHANNELS';
            console.log('ERROR: ' + msg + ' HTTP ' + res.code + ' body: ' + res.body.substring(0, 300));
            return { url: 'http://error/jiujiang?msg=' + encodeURIComponent(msg) };
        }

        let json;
        try {
            json = JSON.parse(res.body);
        } catch (e) {
            let msg = '接口返回的不是合法 JSON';
            console.log('ERROR: ' + msg + ' body: ' + res.body.substring(0, 300));
            return { url: 'http://error/jiujiang?msg=' + encodeURIComponent(msg) };
        }

        // 递归扫描提取 m3u8
        let best = null, any = null;
        function scan(node, depth) {
            if (depth > 10) return;
            if (typeof node === 'string') {
                let m = node.match(/https?:\/\/[^\s"']+\.m3u8[^\s"']*/i);
                if (m) {
                    if (!any) any = m[0];
                }
                return;
            }
            if (typeof node !== 'object' || node === null) return;
            for (let k in node) {
                let v = node[k];
                if (typeof v === 'string') {
                    let m = v.match(/https?:\/\/[^\s"']+\.m3u8[^\s"']*/i);
                    if (m) {
                        let lk = k.toLowerCase();
                        if (!best && (lk.includes('playurl') || lk.includes('m3u8') || ['url','hlsurl','liveurl','playaddress','address'].includes(lk))) {
                            best = m[0];
                        }
                        if (!any) any = m[0];
                    }
                } else {
                    scan(v, depth + 1);
                }
            }
        }
        scan(json, 0);
        url = best || any;

        if (!url) {
            let msg = 'JSON 中没有找到 m3u8 地址';
            console.log('ERROR: ' + msg + ' body: ' + res.body.substring(0, 500));
            return { url: 'http://error/jiujiang?msg=' + encodeURIComponent(msg) };
        }

        // 写入缓存
        ku9.setCache(cacheKey, url, CACHE_TTL_MS);
        debugInfo.parsed = url;
    }

    // 调试模式：输出信息到日志
    if (item.debug) {
        console.log('DEBUG: ' + JSON.stringify(debugInfo));
    }

    // 返回播放地址
    return {
        url: url,
        headers: { 'User-Agent': USER_AGENT }
    };
}