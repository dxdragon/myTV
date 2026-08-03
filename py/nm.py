
from base.parser import Parser
import time
import hashlib
import json
import base64
import struct
from typing import Dict
import requests


class Parser(Parser):
    def parse(self, params: Dict[str, str]) -> Dict[str, str]:

        pid = params.get("id", "nmws")


        n = {
            'nmws': 262,      # 内蒙古卫视
            'nmmyws': 126,    # 内蒙古蒙古语卫视
            'nmxwzh': 127,    # 内蒙古新闻综合
            'nmjjsh': 128,    # 内蒙古经济生活
            'nmse': 129,      # 内蒙古少儿频道
            'nmwtyl': 130,    # 内蒙古文体娱乐
            'nmnm': 131,      # 内蒙古农牧频道
            'nmwh': 132,      # 内蒙古蒙古语文化
            # 地市台
            'hhht1': 141,     # 呼和浩特新闻综合
            'xlgl1': 156,     # 锡林郭勒
            'als1': 157,      # 阿拉善新闻综合
            'byle1': 158,     # 巴彦淖尔
            'erds1': 159,     # 鄂尔多斯
            'cf1': 161,       # 赤峰新闻综合
            'tl1': 163,       # 通辽新闻综合
            'wlcb1': 164,     # 乌兰察布
            'wh1': 165,       # 乌海新闻综合
            'hlbe1': 166,     # 呼伦贝尔新闻综合
            'xa1': 167,       # 兴安新闻综合
            'bt1': 168,       # 包头新闻综合
        }

        if pid not in n:
            return {"error": f"Invalid id: {pid}"}


        encrypted_post_data = 'n6wT4YYLUZiY/41vQYu5oSHD2lotdczz5ohPQw=='

        xxtea_key = '5b28bae827e651b3'

        headers = {
            'Referer': 'https://www.nmtv.cn/',
            'Content-Type': 'application/json; charset=UTF-8'
        }

        try:

            resp = requests.post(
                'https://api-bt.nmtv.cn/broadcast/list',
                data=encrypted_post_data,
                headers=headers,
                timeout=10
            )
            resp.raise_for_status()
            encrypted_resp = resp.text.strip()
            if not encrypted_resp:
                return {"error": "Empty response from API"}
        except Exception as e:
            return {"error": f"Request failed: {e}"}


        decrypted_bytes = self._xxtea_decrypt(encrypted_resp, xxtea_key)
        try:
            decrypted_str = decrypted_bytes.decode('utf-8')
            json_data = json.loads(decrypted_str)
        except Exception as e:
            return {"error": f"Decrypt/parse failed: {e}"}

      
        target_m3u8 = None
        for element in json_data.get('data', []):
            if element.get('data', {}).get('id') == n[pid]:
                target_m3u8 = element['data'].get('streamUrl')
                break

        if not target_m3u8:
            return {"error": f"Channel id {pid} not found in stream list"}


        return {
            "url": target_m3u8,
            "headers": {
                'Referer': 'https://www.nmtv.cn/'
            }
        }

    def _xxtea_decrypt(self, data: str, key: str) -> bytes:
        """"""
        if not data:
            return b''


        try:
            raw_data = base64.b64decode(data)
        except:
            return b''


        def bytes_to_u32(s: bytes):
            n = len(s) // 4
            return list(struct.unpack('<%dI' % n, s))


        def u32_to_bytes(v):
            return struct.pack('<%dI' % len(v), *v)

        v = bytes_to_u32(raw_data)

        key_bytes = key.encode('utf-8')
        if len(key_bytes) < 16:
            key_bytes = key_bytes.ljust(16, b'\0')
        k = bytes_to_u32(key_bytes)

        n = len(v) - 1
        if n < 1:
            return b''


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
        return result_bytes[:orig_len]

    def stop(self):

        pass

    def proxy(self, url: str, headers: Dict[str, str]):

        pass
