/*
四川,#genre#
四川卫视4K,http://P/ku9/js/sc.js?id=10
四川卫视,http://P/ku9/js/sc.js?id=1
四川新闻,http://P/ku9/js/sc.js?id=2
四川经济,http://P/ku9/js/sc.js?id=3
四川文化旅游,http://P/ku9/js/sc.js?id=4
四川影视文艺,http://P/ku9/js/sc.js?id=5
四川妇女儿童,http://P/ku9/js/sc.js?id=6
四川乡村,http://P/ku9/js/sc.js?id=8
康巴卫视,http://P/ku9/js/sc.js?id=9
四川星空购物,http://P/ku9/js/sc.js?id=7
*/
function main(item) {
    var id = item.id || 1 ;
    var headers = {
        'Referer': 'https://www.sctv.com/',
        'User-Agent': 'Mozilla/5.0 (Linux; U; Android 8.1.0; zh-cn; BLA-AL00 Build/HUAWEIBLA-AL00) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/57.0.2987.132 MQQBrowser/8.9 Mobile Safari/537.36'
    };
        var r1 = ku9.request('https://api.vonchange.com/utao/sctv?tag=' + id, 'GET', headers);
        var m3u8Url = r1.body.trim();
        var r2 = ku9.request(m3u8Url, 'GET', headers);    
        var m3u8 = replaceUrls(m3u8Url, r2.body);
        return { m3u8: m3u8 , headers};
}

// 将 m3u8 中的相对路径补全为绝对路径
function replaceUrls(m3u8Url, content) {
    var u = (ku9.Uri||ku9.uri)(m3u8Url);
    var path = u.FullPath;
    var p = path.lastIndexOf('/');
    var dir = u.Scheme + '://' + u.Host + (p > 0 ? path.substring(0, p + 1) : '/');

    var lines = content.split('\n');
    for (var i = 0; i < lines.length; i++) {
        var line = lines[i].replace(/\r$/, '');
        if (!line || line.charAt(0) === '#') continue;
        // 已经是绝对路径的不处理
        if (line.indexOf('http') === 0) continue;
        lines[i] = dir + line;
    }
    return lines.join('\n');
}