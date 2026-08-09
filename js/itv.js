function main(item) {
    const url = item.url || "";

    // 1. 取参数
    let cid = item.cid || ku9.getQuery(url, "cid") || "ystenlive";
    let id  = item.id  || ku9.getQuery(url, "id") || ku9.getQuery(url, "id");

    if (!id) return { url: "Contentid 不能为空" };

    // 2. 真实边缘节点 IP（你给的样例 IP，可按省份替换）
    const edgeIp = "27.185.221.234";

    // 3. 拼 m3u8 地址（你这个格式的固定规律）
    const m3u8 =
        `http://${edgeIp}/000000001000/${id}/1.m3u8` +
        `?channel-id=${cid}` +
        `&Contentid=${id}` +
        `&livemode=1` +
        `&stbId=m` +
        `&domain=cache.ott.wasulive.itv.cmvideo.cn`;

    // 4. 把 CDN 域名绑到边缘 IP（酷9 会走这个 host 解析）
    const host = {
        "cache.ott.wasulive.itv.cmvideo.cn": edgeIp
    };

    return {
        url: m3u8,
        host: host,
        headers: {
            "User-Agent": "Mozilla/5.0",
            "Referer": "http://www.itv.cmvideo.cn/"
        }
    };
}