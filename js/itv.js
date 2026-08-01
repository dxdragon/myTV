function main(item) {
    const cid = ku9.getQuery(item.url, "cid");
    const id = ku9.getQuery(item.url, "id");
    const bk = parseInt(ku9.getQuery(item.url, "bk")) || 0;
    if (!cid || !id) return { url: "" };

    const cacheKey = "itv_auth";
    const baseParams = `channel-id=${cid}&Contentid=${id}&livemode=1&stbId=m`;
    let authInfo = "", domain = "";

    const cached = ku9.getCache(cacheKey);
    if (cached) {
        try {
            const data = JSON.parse(cached);
            if (data.expires > Date.now() && data.cid === cid && data.id === id) {
                authInfo = data.authInfo;
                domain = data.domain;
            }
        } catch(e) {}
    }

    if (!authInfo) {
        const reqUrl = `http://221.181.100.26/gslbserv.itv.cmvideo.cn/1.m3u8?${baseParams}`;
        const res = ku9.request(reqUrl, "GET", {}, null, false);
        const location = res.headers["Location"] || "";
        authInfo = (location.match(/[?&]AuthInfo=([^&]+)/) || [])[1] || "";
        domain = (location.match(/http:\/\/([^\/:]+)/) || [])[1] || "";
        ku9.setCache(cacheKey, JSON.stringify({ cid, id, authInfo, domain, expires: Date.now() + 10500000 }));
    }

    const baseUrl = `http://jscbn.zj-cdn.gitv.tv/000000001000/${id}`;
    const backSec = bk || (cid === "bestzb" ? 60 : 50);
    const startTime = Date.now() - backSec * 1000;

    let m3u8 = "#EXTM3U\n#EXT-X-VERSION:3\n#EXT-X-TARGETDURATION:10\n";
    m3u8 += `#EXT-X-MEDIA-SEQUENCE:${Math.floor(startTime / 10000)}\n`;

    for (let i = 0; i < 2; i++) {
        const ts = new Date(startTime + i * 10000 + 8 * 3600000);
        const yyyymmdd = `${ts.getUTCFullYear()}${String(ts.getUTCMonth() + 1).padStart(2, "0")}${String(ts.getUTCDate()).padStart(2, "0")}`;
        const hh = String(ts.getUTCHours()).padStart(2, "0");
        const mm = String(Math.floor(ts.getUTCMinutes() / 10) * 10).padStart(2, "0");
        const segNum = Math.floor(((ts.getUTCMinutes() % 10) * 60 + ts.getUTCSeconds()) / 10) + 1;
        m3u8 += `#EXTINF:10.000,\n${baseUrl}/${id}_1500000_${yyyymmdd}_${hh}${mm}00_${segNum}.ts?${baseParams}&AuthInfo=${authInfo}&domain=${domain}\n`;
    }

    return { m3u8 };
}