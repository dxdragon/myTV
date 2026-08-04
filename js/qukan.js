function main(item) {
    // 频道简写 -> ID 映射
    const channelMap = {
        'lhws': '1780907795235397', // 莲花卫视
        // 金华频道
        'ykxwzh': '1625061424267104', // 永康新闻综合
        'ykhx': '1625062755227231', // 永康华溪频道
        'dyxwzh': '1681113308206040', // 东阳新闻综合
        'dyyssh': '1681113292195007', // 东阳影视生活
        'wyxwzh': '1707437639053211', // 武义新闻综合
        // 宁波频道
        'xsxwzh': '1702360350551252', // 象山新闻综合
        'yyxwzh': '1718767387926372', // 余姚新闻综合
        // 温州频道
        'cnxwzh': '1726543353849105', // 苍南新闻综合
        'dtzh': '1735612228127376', // 洞头综合
        'wzraxwzh': '1681269183807252', // 温州瑞安新闻综合
        // 绍兴频道
        'kqxwzh': '1640945211435051', // 柯桥新闻综合
        // 丽水频道
        'lqxwzh': '1721354859785237', // 龙泉新闻综合
        'syxwzh': '1718675414025228', // 松阳新闻综合
        'qytv': '1733812606413392', // 庆元电视台
        'qttv': '1692755062081192', // 青田电视台
        'sctv': '1708426592499070', // 遂昌电视台
        'jntv': '1644806967279134', // 景宁电视台
        // 衢州频道
        'lyxwzh': '1703570877483349', // 龙游新闻综合
        'qjzh': '1700720505174325', // 衢江综合
        'csxwzh': '1621306190044902', // 常山新闻综合
        'jsxwzh': '1623117710666335', // 江山新闻综合
        // 嘉兴频道
        'jxxwzh': '1675942165226154', // 嘉兴新闻综合
        'jxwhys': '1675149625220101', // 嘉兴文化影视
        'jxgg': '1675149601192103', // 嘉兴公共
        // 湖州频道
        'cxtv': '1689126294179076', // 长兴电视台
        // 舟山频道
        'zsxwzh': '1699001836208185', // 舟山新闻综合
        'zsgg': '1699002430299200', // 舟山公共
        'pttv': '1679466742638079', // 普陀电视台
        // 台州频道
        'yhxwzh': '1728627049847070', // 玉环新闻综合
        // 江西频道
        'jjxwzh': '1768529286203024', // 九江新闻综合
        'jjgg': '1776821035295363', // 九江公共
        'jjjy': '1776821070594049', // 九江教育
        'srxwzh': '1758679893354090', // 上饶新闻综合
        'srjjly': '1758679936307088', // 上饶经济旅游
        'gftv': '1778463699013144', // 广丰电视台
        'ysxwzh': '1744269699236128', // 玉山新闻综合
        'fcxwzh': '1753663315049013', // 丰城新闻综合
        'dnzh': '1762136155495343', // 定南综合
        'xfzh': '1761874123034214', // 信丰综合
        'rjzh': '1760408109205119', // 瑞金综合
        'rjgb': '1764299633763119', // 瑞金综合广播
        'dyzh': '1778834121181242', // 大余综合
        'ndzh': '1775696284668325', // 宁都综合
        'gxxwzh': '1760926953729140', // 赣县新闻综合
        'nkzhpd': '1758525653004384', // 南康综合频道
        'jdzxwzh': '1784769813731138', // 景德镇新闻综合
        'pxxwzh': '1767680696432348', // 萍乡新闻综合
        'wazh': '1779865659163098', // 万安综合
        'sczh': '1779777834106237', // 遂川综合
        // 宁夏频道
        'ycsh': '1759132827032262', // 银川生活
        'ycgg': '1759132792923073', // 银川公共
        'ycwt': '1759132882868161', // 银川文体
        // 广西频道
        'tdzh': '1758786150192313', // 田东综合
    };
    
    // 获取频道简写
    let shortId = ku9.getQuery(item.url, "id");
    
    if (!shortId) {
        return { error: "请提供频道ID" };
    }
    
    // 获取对应的真实ID
    const liveId = channelMap[shortId];
    if (!liveId) {
        return { error: `频道 ${shortId} 不存在` };
    }
    
    // 生成签名
    const sign = ku9.md5(liveId + 'NoFeelings');
    
    // 请求播放地址
    const apiUrl = 'https://www.qukanvideo.com/h5/channel/view/item/AntiTheft/playUrl';
    const postData = `source=web&liveId=${liveId}&sign=${sign}`;
    
    const res = ku9.request(apiUrl, "POST", {
        'origin': 'https://www.qukanvideo.com',
        'referer': `https://www.qukanvideo.com/cloud/h5/${liveId}`,
        'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36',
        'Content-Type': 'application/x-www-form-urlencoded'
    }, postData);
    
    if (res.code !== 200 || !res.body) {
        return { error: `请求失败: ${res.code}` };
    }
    
    try {
        const data = JSON.parse(res.body);
        const playUrl = data?.value?.url;
        
        if (playUrl) {
            return { 
                url: playUrl,
                headers: {
                    'Referer': 'https://www.qukanvideo.com/',
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                }
            };
        } else {
            return { error: "未找到播放地址" };
        }
    } catch (e) {
        return { error: `解析失败: ${e.message}` };
    }
}