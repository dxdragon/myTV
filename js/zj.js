function main( item ) {
    var id = ku9.getQuery( item.url, "id" ) || "zjws";
   
    // 直接生成1080P播放地址
    var playurl = generate1080PUrl(id);
   
    return { url: playurl };
}

// 生成1080P播放地址
function generate1080PUrl(channelId) {
    // 频道映射
    var channelMap = {
        'zjws': '01',   //浙江卫视
        'zjqj': '02',   //浙江钱江都市
        'zjjjsh': '03', //浙江经济生活
        'zjjkys': '04', //浙江教科影视
        'zjmsxx': '06', //浙江民生休闲
        'zjxw': '07',   //浙江新闻
        'zjse': '08',   //浙江少儿
        'zjgj': '10',   //浙江国际
        'zjhyg': '11',  //浙江好易购
        'zjzjjl': '12', //浙江之江纪录 
    };
   
    var channelCode = channelMap[channelId] || '01'; // 默认浙江卫视
   
    var path = "/live/channel" + channelCode + "1080Pnew.m3u8";
    var timestamp = Math.floor(Date.now() / 1000);
    var key = 'CHWr9VybUeBZE1VB';
   
    // 生成签名
    var signStr = path + '-' + timestamp + '-0-0-' + key;
    var signature = ku9.md5(signStr);
   
    var auth_key = timestamp + '-0-0-' + signature;
   
    // 服务器列表
    var servers = ['zwebl02', 'zwebl04', 'zwebl06'];
    var server = servers[Math.floor(Math.random() * servers.length)];
   
    return "http://" + server + ".cztv.com" + path + "?auth_key=" + auth_key;
}