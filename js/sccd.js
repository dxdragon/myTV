function main(item) {
    // 获取id参数
    const vid = item.id;
   
    // 频道映射对象
    const n = {
        'cdxw': 'cdn1.cditv.cn/cdtv1high/CDTV1High', // 成都新闻综合HD
        'cdjj': 'cdn1.cditv.cn/cdtv2high/CDTV2High', // 成都经济资讯HD
        'cdsh': 'cdn1.cditv.cn/cdtv3high/CDTV3High', // 成都都市生活HD
        'cdys': 'cdn1.cditv.cn/cdtv4high/CDTV4High', // 成都影视文艺HD
        'cdgg': 'cdn1.cditv.cn/cdtv5high/CDTV5High', // 成都公共HD
        'cdse': 'cdn1.cditv.cn/cdtv6high/CDTV6High', // 成都少儿HD
        'cdrc': 'cdn1.cditv.cn/dangjiaohigh/dangjiaoHigh', // 成都蓉城先锋HD
        'chyx': 'quxian.pull.cditv.cn/live/chenghua', // 成华有线
        'cztv': 'quxian.pull.cditv.cn/live/chongzhou', // 崇州电视1套
        'djytv': 'quxian.pull.cditv.cn/live/dujiangyan', // 都江堰电视台
        'dyxwzh': 'quxian.pull.cditv.cn/live/dayi', // 大邑综合
        'gxtv': 'quxian.pull.cditv.cn/live/gaoxin', // 高新电视台
        'jjtv': 'quxian.pull.cditv.cn/live/jinjiang', // 锦江电视台
        'jntv': 'jntv.pull.cditv.cn/live/jntv', // 金牛电视台
        'jttv': 'quxian.pull.cditv.cn/live/jintang', // 金堂电视台
        'jyxwzh': 'quxian.pull.cditv.cn/live/jianyang', // 简阳新闻综合
        'lqzh': 'quxian.pull.cditv.cn/live/longquanyi', // 龙泉综合
        'pdxwzh': 'quxian.pull.cditv.cn/live/pidu', // 郫都新闻综合
        'pjtv': 'quxian.pull.cditv.cn/live/pujiang', // 蒲江电视台
        'pztv': 'quxian.pull.cditv.cn/live/pengzhou', // 彭州电视台
        'qbjtv': 'quxian.pull.cditv.cn/live/qingbaijiang', // 青白江电视台
        'qltv': 'quxian.pull.cditv.cn/live/qionglai', // 邛崃电视台
        'qytv': 'quxian.pull.cditv.cn/live/qingyang', // 青羊电视台
        'slzh': 'quxian.pull.cditv.cn/live/shuangliu', // 双流综合
        'whtv': 'quxian.pull.cditv.cn/live/wuhou', // 武侯电视台
        'wjtv': 'quxian.pull.cditv.cn/live/wenjiang', // 温江电视台
        'xdzh': 'quxian.pull.cditv.cn/live/xindu', // 新都电视台
        'xjtv': 'quxian.pull.cditv.cn/live/xinjin' // 新津电视台
    };

    // 检查vid是否存在于映射中
    if (n[vid]) {
        // 构建API请求URL
        const apiUrl = 'https://cstvweb.cdmp.candocloud.cn/live/getLiveUrl?url=https://' + n[vid] + '.flv/playlist.m3u8';
        
        // 发送网络请求
        const res = ku9.request(apiUrl, "GET", null, null, false);
        
        // 解析返回的JSON数据
        const response = JSON.parse(res.body);
        
        // 返回播放地址
        return { url: response.data.url };
        // 或者使用：return JSON.stringify({ url: response.data.url });
    }
   
    // 如果没有匹配的频道，返回空对象
    return {};
}