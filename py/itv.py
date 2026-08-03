from base.parser import Parser
import re
import requests
import json
import os
from datetime import datetime, timedelta, timezone
from typing import Tuple, Any, Dict, Union, Iterable
from urllib.parse import urlparse, parse_qs

class Parser(Parser):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self._cache_file = os.path.join(os.path.dirname(os.path.abspath(__file__)), '.itv_auth.json')

    def _fetch_auth(self, cid: str, id: str, base_params: str) -> Tuple[str, str]:
        # 请求获取 AuthInfo 和 domain
        try:
            req_url = f"http://221.181.100.26/gslbserv.itv.cmvideo.cn/1.m3u8?{base_params}"
            resp = requests.get(req_url, timeout=5, allow_redirects=False)
            location = resp.headers.get('Location', '')
            # 提取 domain
            domain = re.search(r'://([^/:]+)', location).group(1) if location else ''
            # 提取 AuthInfo
            auth_info = re.search(r'[?&]AuthInfo=([^&]+)', location).group(1) if location else ''
            return auth_info, domain
        except:
            return '', ''

    def _save_cache(self, cid: str, id: str, auth_info: str, domain: str):
        # 保存认证信息到缓存（格式化输出）
        data = {
            'cid': cid,
            'id': id,
            'AuthInfo': auth_info,
            'domain': domain,
            'expires': int(datetime.now().timestamp() + 10500)
        }
        try:
            with open(self._cache_file, 'w') as f:
                json.dump(data, f, indent=2, ensure_ascii=False)
        except:
            pass

    def _load_cache(self, cid: str, id: str) -> Tuple[str, str, bool]:
        # 读取缓存，检查 AuthInfo 和 domain 是否有效
        try:
            with open(self._cache_file, 'r') as f:
                data = json.load(f)
            if data.get('cid') == cid and data.get('id') == id and data.get('expires', 0) > datetime.now().timestamp():
                return data.get('AuthInfo', ''), data.get('domain', ''), True
        except:
            pass
        return '', '', False

    def parse(self, params: Dict[str, str]) -> Dict[str, str]:
        # 解析参数，构建请求 URL
        cid, id = params.get("cid", ""), params.get("id", "")
        if not cid or not id:
            return {"url": ""}
        query = f"cid={cid}&id={id}"
        if playseek := params.get("playseek"):
            query += f"&playseek={playseek}"
        if bk := params.get("bk"):
            query += f"&bk={bk}"
        return {"url": f"{self.address}?{query}"}

    def proxy(self, url: str, headers: Dict[str, Any]) -> Tuple[Union[bytes, Iterable[bytes]], Dict[str, str]]:
        # 代理请求，生成 M3U8 内容
        qs = parse_qs(urlparse(url).query)
        cid, id = qs.get("cid", [""])[0], qs.get("id", [""])[0]
        if not cid or not id:
            err_msg = "#EXTM3U\n# 错误：缺少 cid 或 id 参数"
            return [err_msg.encode("utf-8")], {"Content-Type": "application/vnd.apple.mpegurl"}

        playseek = qs.get("playseek", [""])[0]
        back = int(qs.get("bk", [0])[0]) if qs.get("bk") else None
        base_params = f"channel-id={cid}&Contentid={id}&livemode=1&stbId=m"
        base_url = f"http://jscbn.zj-cdn.gitv.tv/000000001000/{id}"
        tz = timezone(timedelta(hours=8))

        # 回看模式：强制刷新
        if playseek and re.match(r"\d{14}-\d{14}$", playseek):
            auth_info, domain = self._fetch_auth(cid, id, base_params)
            self._save_cache(cid, id, auth_info, domain)
            suffix = f"?{base_params}&AuthInfo={auth_info}&domain={domain}"
            
            start, end = playseek.split("-")
            start_dt = datetime.strptime(start, "%Y%m%d%H%M%S").replace(tzinfo=tz)
            end_dt = datetime.strptime(end, "%Y%m%d%H%M%S").replace(tzinfo=tz)
            segs = []
            cur = start_dt
            while cur < end_dt:
                dur = min(10, (end_dt - cur).total_seconds())
                segs.append(f"#EXTINF:{dur:.1f},\n{self._ts_url(base_url, id, cur, suffix)}")
                cur += timedelta(seconds=10)
            m3u8 = "#EXTM3U\n#EXT-X-VERSION:3\n#EXT-X-TARGETDURATION:10\n#EXT-X-MEDIA-SEQUENCE:0\n" + "\n".join(segs) + "\n#EXT-X-ENDLIST"
        else:
            # 直播模式：读缓存，过期则刷新
            auth_info, domain, ok = self._load_cache(cid, id)
            if not ok:
                auth_info, domain = self._fetch_auth(cid, id, base_params)
                self._save_cache(cid, id, auth_info, domain)
            suffix = f"?{base_params}&AuthInfo={auth_info}&domain={domain}"
            
            back = back or (60 if cid == "bestzb" else 50)
            now = datetime.now(tz) - timedelta(seconds=back)
            seq = int(now.timestamp()) // 10
            m3u8 = f"#EXTM3U\n#EXT-X-VERSION:3\n#EXT-X-TARGETDURATION:10\n#EXT-X-MEDIA-SEQUENCE:{seq}\n"
            for i in range(2):
                m3u8 += f"#EXTINF:10.0,\n{self._ts_url(base_url, id, now + timedelta(seconds=i*10), suffix)}\n"

        return [m3u8.encode("utf-8")], {"Content-Type": "application/vnd.apple.mpegurl"}

    def _ts_url(self, base_url: str, id: str, dt: datetime, suffix: str) -> str:
        # 生成 TS 切片 URL
        block_min = (dt.minute // 10) * 10
        seg_num = int(((dt.minute % 10) * 60 + dt.second) // 10) + 1
        return f"{base_url}/{id}_1500000_{dt.strftime('%Y%m%d')}_{dt.hour:02d}{block_min:02d}00_{seg_num}.ts{suffix}"

    def stop(self):
        # 换台时调用，用于清理缓存
        pass