#!/usr/bin/env python3
# -*- coding: utf-8 -*-

from base.parser import Parser as BaseParser
import requests
import base64
import struct
import json
from typing import Dict, Any, Tuple, Union, Iterable

class Parser(BaseParser):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.session = requests.Session()

    def _xxtea_decrypt(self, data: str, key: str) -> str:
        if not data:
            return ""

        try:
            raw = base64.b64decode(data)
        except Exception:
            return ""

        def bytes_to_u32(s: bytes):
            n = len(s) // 4
            return list(struct.unpack(f'<{n}I', s))

        def u32_to_bytes(v):
            return struct.pack(f'<{len(v)}I', *v)

        v = bytes_to_u32(raw)
        key_bytes = key.encode('utf-8')
        if len(key_bytes) < 16:
            key_bytes = key_bytes.ljust(16, b'\0')
        k = bytes_to_u32(key_bytes)

        n = len(v) - 1
        if n < 1:
            return ""

        if len(k) < 4:
            k += [0] * (4 - len(k))

        delta = 0x9E3779B9
        rounds = 6 + 52 // (n + 1)
        sum_val = (rounds * delta) & 0xFFFFFFFF
        z = v[n]
        y = v[0]

        while rounds > 0:
            e = (sum_val >> 2) & 3
            for p in range(n, 0, -1):
                z = v[p - 1]
                mx = (((z >> 5) ^ (y << 2)) + ((y >> 3) ^ (z << 4))) ^ ((sum_val ^ y) + (k[(p & 3) ^ e] ^ z))
                mx &= 0xFFFFFFFF
                y = v[p] = (v[p] - mx) & 0xFFFFFFFF
            z = v[n]
            mx = (((z >> 5) ^ (y << 2)) + ((y >> 3) ^ (z << 4))) ^ ((sum_val ^ y) + (k[(0 & 3) ^ e] ^ z))
            mx &= 0xFFFFFFFF
            y = v[0] = (v[0] - mx) & 0xFFFFFFFF
            sum_val = (sum_val - delta) & 0xFFFFFFFF
            rounds -= 1

        result_bytes = u32_to_bytes(v)
        orig_len = v[-1]
        decrypted_bytes = result_bytes[:orig_len]
        try:
            return decrypted_bytes.decode('utf-8')
        except UnicodeDecodeError:
            return ""

    def _get_real_url(self, channel_id: str) -> str:
        channel_map = {
            'jlws': 2,      # 吉林卫视
            'jlds': 3,      # 吉林都市
            'jlsh': 4,      # 吉林生活
            'jlys': 5,      # 吉林影视
            'jlxc': 6,      # 吉林乡村
            'jlzywh': 8,    # 吉林综艺·文化
            'ybws': 22,     # 延边卫视
            'cczh': 31,     # 长春综合
            'jlszh': 23,    # 吉林市新闻综合
            'spzh': 24,     # 四平新闻综合
            'lyzh': 25,     # 辽源新闻综合
            'thzh': 26,     # 通化新闻综合
            'bszh': 29,     # 白山新闻综合
            'bczh': 27,     # 白城新闻综合
            'syzh': 28,     # 松原新闻综合
        }

        if channel_id not in channel_map:
            return ""

        target_id = channel_map[channel_id]
        url = 'https://clientapi.jlntv.cn/broadcast/list?page=1&size=10000&type=1'
        headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 6.1)'
        }
        try:
            resp = self.session.get(url, headers=headers, timeout=10, verify=False)
            if resp.status_code != 200:
                return ""

            res_text = resp.text.strip()
            if res_text.startswith('"') and res_text.endswith('"'):
                res_text = res_text[1:-1]

            decrypted_str = self._xxtea_decrypt(res_text, "5b28bae827e651b3")
            if not decrypted_str:
                return ""

            json_data = json.loads(decrypted_str)
            for element in json_data.get('data', []):
                if element.get('data', {}).get('id') == target_id:
                    play_url = element['data'].get('streamUrl')
                    if play_url:
                        return play_url
            return ""
        except Exception:
            return ""

    def parse(self, params: Dict[str, str]) -> Dict[str, str]:
        channel_id = params.get('id', '').strip()
        if not channel_id:
            return {"error": "Missing 'id' parameter"}

        real_url = self._get_real_url(channel_id)
        if not real_url:
            return {"error": f"Failed to get stream URL for id={channel_id}"}

        return {
            "url": real_url,
            "headers": {
                'User-Agent': 'Mozilla/5.0 (Windows NT 6.1)'
            }
        }

    def proxy(self, url: str, headers: Dict[str, Any]) -> Tuple[Union[bytes, Iterable[bytes]], Dict[str, str]]:
        return self._error("Proxy not supported in this parser", 501)

    def _error(self, msg: str, code: int = 500):
        b = f"[Error] {msg}".encode()
        h = {
            'Content-Type': 'text/plain',
            'Content-Length': str(len(b)),
            'Access-Control-Allow-Origin': '*'
        }
        return b, h

    def stop(self):
        self.session.close()

    def __del__(self):
        self.stop()
