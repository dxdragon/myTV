/**
 * 酷9直播代理脚本（精简优化版）
 * 纯计算生成 M3U8，无需网络请求
 */
function main(item) {
    let channelId = ku9.getQuery(item.url, "cid");
    let contentId = ku9.getQuery(item.url, "id");

    if (!channelId || !contentId) {
        return { m3u8: "#EXTM3U\n# 错误：缺少必要参数" };
    }

    // 时间回退80秒，确保切片可用
    let now = new Date();
    now.setSeconds(now.getSeconds() - 80);
    
    let baseUrl = "http://36.155.98.21/gslbserv.itv.cmvideo.cn/";
    let qs = "?channel-id=" + channelId + "&Contentid=" + contentId + "&livemode=1&stbId=m";
    
    let m3u8 = "#EXTM3U\n#EXT-X-VERSION:3\n#EXT-X-TARGETDURATION:10\n";
    
    // 计算 MEDIA-SEQUENCE：Unix 时间戳（秒）除以 10
    let unixTimestamp = Math.floor(now.getTime() / 1000);
    let mediaSequence = Math.floor(unixTimestamp / 10);
    
    m3u8 += "#EXT-X-MEDIA-SEQUENCE:" + mediaSequence + "\n";
    
    // 生成5个片段
    for (let segIndex = 0; segIndex < 5; segIndex++) {
        // 计算当前片段的时间点（当前时间 + 片段偏移）
        let segmentTime = new Date(now);
        segmentTime.setSeconds(segmentTime.getSeconds() + segIndex * 10);
        
        let Ymd = segmentTime.getFullYear() + 
                  String(segmentTime.getMonth() + 1).padStart(2, '0') + 
                  String(segmentTime.getDate()).padStart(2, '0');
        
        let H = segmentTime.getHours();
        let M = segmentTime.getMinutes();
        let S = segmentTime.getSeconds();
        
        // 计算所在10分钟块
        let blockMin = Math.floor(M / 10) * 10;
        let curHHmmss = String(H).padStart(2, '0') + 
                        String(blockMin).padStart(2, '0') + "00";
        
        // 计算片段序号（每个10分钟块有60个10秒片段）
        let secondsInBlock = (M % 10) * 60 + S;
        let segmentNum = Math.floor(secondsInBlock / 10) + 1;
        
        // 生成片段URL
        let segmentUrl = baseUrl + contentId + "_1500000_" + Ymd + "_" + curHHmmss + "_" + segmentNum + ".ts" + qs;
        
        m3u8 += "#EXTINF:10.0,\n" + segmentUrl + "\n";
    }
    
    return { m3u8: m3u8 };
}