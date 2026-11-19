# -*- coding: utf-8 -*-
"""
版本记录：
#2026.6.27 修复重定向后错误切换代理问题，沿用当前代理
#2026.6.24 修复代理切换时连接池污染问题，每次请求使用独立Session
#2026.6.24 增加代理轮询和智能重试机制
#2026.6.4 修复 HTTP→HTTPS 重定向问题，增强代理规则匹配
#2026.5.31 重构代理参数：支持socks5和http参数，规则中直接指定代理类型
#2026.5.16 增加域名/IP的socks5代理规则匹配功能
#2026.5.14 重庆、安徽移动回看路径替换
"""

from base.parser import Parser as BaseParser
import requests
import urllib.parse
from typing import Tuple, Any, Dict, Union, Iterable, List, Optional
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry
import socket
import sys
import re
import ipaddress
import time

# --- 【代理规则配置】 ---
# 格式: (匹配规则, 代理地址, 代理类型)
# 匹配规则支持:
#   - 域名(支持通配符 *): "*.chinamobile.com", "otttv.bj.chinamobile.com"
#   - IP地址: "192.168.1.1"
#   - CIDR网段: "192.168.2.0/24", "10.0.0.0/8"
# 代理类型: "socks5" 或 "http"
# 调用格式：py://socks5.py?(ip=代理ip:端口&)u=源地址
PROXY_RULES: List[Tuple[str, str, str]] = [
    # 北京移动
    ("*.bj.chinamobile.com", "116.196.111.171:64235", "socks5"),
    ("39.134.135.10", "116.196.111.171:64235", "socks5"),
    ("122.114.0.230", "122.114.0.230:39179", "socks5"),
    
    # 北京联通
    ("61.135.88.136", "120.27.137.221:26839", "socks5"),
    
    # 广东移动
    ("*.hw.gmcc.net", "36.33.1.106:37645", "socks5"),
    ("*.hw.gmcc.net", "118.145.185.108:44122", "socks5"),
    
    # 广东谷豆
    ("172.16.149.22", "103.39.201.68:43211", "http"),
    
    # 广东联通
    ("112.89.121.21", "118.145.141.251:44019", "socks5"),
    ("112.89.121.21", "183.237.49.224:7303", "socks5"),
    
    # 广东电信
    ("183.59.0.0/16", "175.27.157.206:8091", "socks5"),
    ("183.59.0.0/16", "118.145.185.108:44093", "socks5"),
    ("183.59.0.0/16", "118.145.185.108:44118", "socks5"),
    ("183.59.0.0/16", "118.145.185.108:44114", "socks5"),
      
    # 广西移动
    ("*.gx.chinamobile.com", "120.196.95.178:43975", "socks5"),
    
    # 江苏移动
    ("*.mobaibox.com", "124.128.96.68:64159", "socks5"),
    ("*.mobaibox.com", "36.138.206.172:1080", "socks5"),
    ("*.mobaibox.com", "223.111.182.16:1552", "socks5"),
    ("183.207.249.71", "106.75.210.92:1011", "socks5"),
    ("223.110.0.0/8", "124.128.96.68:64159", "socks5"),
    
    # 江苏联通
    ("112.86.202.37", "ircontrolfjgd.huan.tv:51084", "socks5"),
    ("122.96.52.98", "ircontrolfjgd.huan.tv:51084", "socks5"),
    
    # 河南移动
    ("*.ha.chinamobile.com", "39.164.245.25:8085", "socks5"),
    ("*.ha.chinamobile.com", "192.144.137.222:1552", "socks5"),
    
    # 新疆移动
    ("117.146.223.183", "47.95.206.224:45145", "socks5"),
    ("223.116.236.197", "117.191.129.30:8003", "socks5"),
    
    # 浙江移动
    ("*.zj.chinamobile.com", "111.0.41.15:1010", "socks5"),
    ("*.zj.chinamobile.com", "112.16.79.24:65522", "socks5"),
    ("*.zj.chinamobile.com", "111.2.64.140:12200", "socks5"),
    ("39.134.184.82", "112.16.79.24:65522", "socks5"),
    ("*.zj.chinamobile.com", "118.31.12.0:45208", "http"),
    
    # 湖南移动
    ("39.134.240.3/24", "117.80.237.63:20249", "socks5"),
    ("39.134.13.35/24", "117.80.237.63:20249", "socks5"),  # 修复：使用有效代理
    ("*.hn.chinamobile.com", "117.80.237.63:20249", "socks5"),
    ("120.226.116.22", "118.145.141.251:45151", "http"),
    ("183.215.215.210", "118.145.141.251:44027", "socks5"),
    ("120.226.116.22", "118.145.141.251:45151", "socks5"),
    
    # 福建电信
    ("27.148.240.181", "59.58.135.98:21080", "socks5"),
    ("27.148.240.181", "27.150.188.204:33211", "socks5"),
    
    # 福建移动
    ("*.fj.chinamobile.com", "112.5.173.148:63180", "socks5"),
    
    # 江西移动
    ("*.jx.chinamobile.com", "223.84.209.85:9081", "socks5"),
    ("*.jx.chinamobile.com", "36.154.127.230:10082", "socks5"),
    
    # 陕西移动
    ("*.sn.chinamobile.com", "113.141.90.77:24596", "socks5"),
    ("111.20.33.93", "113.141.90.77:24596", "socks5"),
    
    # 黑龙江移动
    ("39.134.65.106", "42.101.8.176:8073", "socks5"),
    ("*.hl.chinamobile.com", "42.101.8.176:8073", "socks5"),
    
    # 内蒙古移动
    ("111.56.121.176", "110.16.92.230:18110", "socks5"),
    ("111.56.121.176", "110.16.92.230:18107", "socks5"),
    ("111.56.121.176", "118.31.12.0:45217", "http"),
    
    # 山东电信
    ("150.138.8.143", "47.98.183.2:44057", "socks5"),
    ("150.138.8.143", "182.37.66.186:7302", "socks5"),
    
    # 山东移动
    ("*.sd.chinamobile.com", "47.98.183.2:44071", "socks5"),
    ("*.sd.chinamobile.com", "223.99.197.190:11012", "socks5"),
    
    # 辽宁移动
    ("*.ln.chinamobile.com", "115.231.37.187:20185", "socks5"),
    ("*.ln.chinamobile.com", "36.129.153.69:54289", "socks5"),
    
    # 辽宁电信
    ("10.255.128.136", "47.98.183.2:44076", "socks5"),
    
    # 河北移动
    ("hbgslbserv.taipan.jda.bcs.ottcn.com", "120.211.242.228:23799", "socks5"),
    
    # 山西移动
    ("live.ott.cdn.10086.cn", "183.201.208.25:2022", "socks5"),
    ("*.sx.chinamobile.com", "183.201.208.25:2022", "socks5"),
    
    # 湖北移动
    ("111.48.246.74", "223.75.121.218:12120", "socks5"),
    ("111.48.246.74", "117.88.244.241:54919", "socks5"),
    
    # 吉林联通
    ("222.161.218.244", "8.210.8.187:6017", "socks5"),
    
    # 浙江联通
    ("124.90.44.40", "101.71.15.244:10831", "socks5"),
    
    # 云南联通
    ("14.204.32.194", "47.101.45.83:6000", "socks5"),
    
    # 云南移动
    ("39.130.237.1/24", "1.13.251.150.1055", "socks5"),
    ("*.yn.chinamobile.com", "1.13.251.150.1055", "socks5"),
    
    # 河南电信
    ("219.150.217.47", "125.45.145.205:5555", "socks5"),
    ("222.85.69.6", "106.227.82.226:62201", "socks5"),
    
    # 四川联通
    ("sc.rrs.169ol.com", "112.193.4.79:50001", "socks5"),
    
    # 江西电信
    ("115.153.251.82/24", "106.227.82.226:60717", "socks5"),
    ("115.153.251.82/24", "218.78.132.204:15362", "socks5"),
    
    # 秦岭云
    ("zycfcdn.gdwlcloud.com", "122.114.0.59:18139", "socks5"),
    
    # 湖北联通
    ("122.191.60.195", "122.191.108.27:38201", "socks5"),
    
    # 贵州移动
    ("*.gz.chinamobile.com", "47.98.183.2:44115", "socks5"),
    ("*.gz.chinamobile.com", "118.31.12.0:45198", "http"),
    
    # 上海联通
    ("10.223.3.189", "124.221.130.67:40510", "socks5"),
    
    # 安徽联通
    ("10.255.127.35", "58.242.191.146:5138", "socks5"),
    ("10.255.126.3", "58.242.191.146:5138", "socks5"),
    ("10.255.127.35", "118.31.12.0:45005", "http"),
    ("10.255.126.3", "118.31.12.0:45005", "http"),
    
    # 安徽移动
    ("120.210.193.151", "118.31.12.0:44055", "socks5"),
    ("120.210.193.151", "118.31.12.0:44089", "http"),
    
    # 台湾
    ("play.hdlive.tv", "210.201.54.215:7082", "socks5"),
    ("125.227.210.55", "210.201.54.215:7082", "socks5"),
    
    # 广西电信
    ("171.105.39.110", "180.141.88.241:9009", "socks5"),
    
    # 重庆移动
    ("39.134.2.22", "113.250.190.81:32735", "socks5"),
    ("ltccq.cqa.bcs.ottcn.com", "113.250.190.81:32735", "socks5"),
    
    # 海南移动
    ("39.136.40.135", "111.29.38.32:2022", "socks5"),
    ("*.hiiptv.cn", "111.29.38.32:2022", "socks5"),
    
    # 吉林移动
    ("39.134.165.137", "118.31.12.0:44178", "socks5"),
    
    # 宁夏移动
    ("gslbserv.itv.cmvideo.cn", "47.95.206.224:44158", "socks5"),
    
    # 青海移动
    ("39.137.75.229", "111.12.205.234:8199", "socks5"),
    
    # 上海移动
    ("39.134.91.132", "36.134.39.39:10087", "socks5"),
    ("*.sh.chinamobile.com", "36.134.39.39:10087", "socks5"),
    ("*.sh.chinamobile.com", "118.31.12.0:45019", "http"),
    
    # 谷豆
    ("172.16.149.20", "118.145.141.251:44036", "socks5"),
    ("116.199.5.1/24", "118.145.141.251:44036", "socks5"),
    ("172.16.149.20", "112.74.165.243:1011", "socks5"),
    
    # 甘肃移动
    ("39.134.34.25", "47.95.206.224:45138", "http"),
    
    # 蜀小果 (四川广电)
    ("live2.rxip.sc96655.com", "36.133.69.144:9004", "socks5"),
    ("live2.rxip.sc96655.com", "117.175.168.195:1080", "socks5"),
    ("live2.rxip.sc96655.com", "118.121.202.114:91", "socks5"),
    ("*.live3.omd.sc96655.com", "223.113.241.216:59999", "socks5"),
    
    # 歌华有线 (北京广电)
    ("*.gehua.net.cn", "116.204.7.195:8112", "socks5"),
    
    # 4gtv 台湾
    ("213.210.5.152", "112.230.74.91:20002", "http"),
    ("4gtvfreemobile-mozai.4gtv.tv", "103.147.22.106:55183", "socks5"),
    ("*.4gtv.tv", "103.147.22.106:55183", "socks5"),
]

# --- 【回看时路径替换规则配置】 ---
PATH_REPLACE_PATTERNS: List[Tuple[str, str]] = [
    ('/180000001001/', '/180000002001/'),
    ('/180000001002/', '/180000002002/'),
    ('/120000001002/', '/120000002002/'),
    ('/200000001898/', '/200000002898/'),
    ('/000000001000/', '/000000002000/'),
    ('/000000001666/', '/000000002666/'),
    ('/live1/', '/lookback/'),
]

# --- 【关键补丁函数】过滤 IPv6 ---
original_getaddrinfo = socket.getaddrinfo

def getaddrinfo_ipv4_only(*args):
    try:
        res = original_getaddrinfo(*args)
        ipv4_res = [r for r in res if r[0] == socket.AF_INET]
        if not ipv4_res and res:
            if res[0][0] == socket.AF_INET6:
                return []
            return res
        return ipv4_res
    except Exception as e:
        return original_getaddrinfo(*args)

def match_proxy_rule(host: str) -> Tuple[Optional[str], Optional[str]]:
    """匹配代理规则，返回第一个匹配的 (代理地址, 代理类型)"""
    for rule, proxy_addr, proxy_type in PROXY_RULES:
        if not proxy_addr:
            continue
            
        if '/' in rule:
            try:
                ip = ipaddress.ip_address(host)
                network = ipaddress.ip_network(rule, strict=False)
                if ip in network:
                    return proxy_addr, proxy_type
            except ValueError:
                pass
            continue
        
        if '*' in rule:
            regex_pattern = '^' + re.escape(rule).replace(r'\*', '.*') + '$'
            if re.match(regex_pattern, host, re.IGNORECASE):
                return proxy_addr, proxy_type
        else:
            if host.lower() == rule.lower():
                return proxy_addr, proxy_type
    
    return None, None

class Parser(BaseParser):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        if not hasattr(self, 'address'):
            self.address = "http://127.0.0.1:9990/ku9/py/proxy"

    def _create_session(self) -> requests.Session:
        s = requests.Session()
        retry_strategy = Retry(
            total=2,
            backoff_factor=0.1,
            status_forcelist=[408, 500, 502, 503, 504, 599]
        )
        adapter = HTTPAdapter(pool_connections=20, pool_maxsize=50, max_retries=retry_strategy)
        s.mount('http://', adapter)
        s.mount('https://', adapter)
        s.headers.update({
            'Accept': '*/*',
            'Accept-Encoding': 'identity',
            'Connection': 'keep-alive',
            'User-Agent': 'okhttp/3.15',
        })
        return s

    def _get_proxy(self, proxy_addr: str, proxy_type: str) -> Dict[str, str]:
        if not proxy_addr:
            return {}
        
        if proxy_type == 'socks5':
            return {"http": f"socks5h://{proxy_addr}", "https": f"socks5h://{proxy_addr}"}
        elif proxy_type == 'http':
            return {"http": f"http://{proxy_addr}", "https": f"http://{proxy_addr}"}
        else:
            return {"http": f"socks5h://{proxy_addr}", "https": f"socks5h://{proxy_addr}"}

    def _resolve_proxy(self, u: str, provided_socks5: str, provided_http: str, 
                       current_proxy: str = None, current_type: str = None) -> Tuple[str, str]:
        """
        解析代理地址
        优先级: 传入参数 > 当前使用的代理 > 规则匹配
        
        Args:
            u: 目标URL
            provided_socks5: 传入的socks5代理
            provided_http: 传入的http代理
            current_proxy: 当前正在使用的代理地址
            current_type: 当前正在使用的代理类型
            
        Returns:
            (代理地址, 代理类型)
        """
        # 1. 用户显式传入的代理（最高优先级）
        if provided_socks5:
            return provided_socks5, 'socks5'
        
        if provided_http:
            return provided_http, 'http'
        
        # 2. 当前正在使用的代理（重定向后沿用）
        if current_proxy and current_type:
            return current_proxy, current_type
        
        # 3. 规则匹配（兜底）
        try:
            url_decoded = urllib.parse.unquote(u)
            parsed = urllib.parse.urlparse(url_decoded)
            host = parsed.hostname
            if host:
                addr, ptype = match_proxy_rule(host)
                if addr:
                    return addr, ptype
        except Exception:
            pass
        
        return "", ""

    def _fix_url_query(self, url: str) -> str:
        if '?' not in url and '&' in url:
            url = url.replace('&', '?', 1)
        return url

    def _extract_params_from_u(self, u_value: str) -> Tuple[str, Dict[str, str]]:
        try:
            parsed = urllib.parse.urlparse(u_value)
            base = urllib.parse.urlunparse((parsed.scheme, parsed.netloc, parsed.path, '', '', ''))
            internal_params = urllib.parse.parse_qs(parsed.query, keep_blank_values=True)
            internal_params = {k: v[0] for k, v in internal_params.items()}
        except Exception:
            base = u_value
            internal_params = {}
        return base, internal_params

    def _apply_path_replacements(self, url: str) -> str:
        result = url
        for old, new in PATH_REPLACE_PATTERNS:
            if old in result:
                result = result.replace(old, new)
        return result

    def _is_replay_mode(self, params: Dict[str, str]) -> bool:
        if 'playseek' in params and params['playseek']:
            return True
        if 'starttime' in params and 'endtime' in params:
            return True
        return False

    def _apply_special_processing_to_url(self, url: str, params: Dict[str, str]) -> str:
        if self._is_replay_mode(params):
            return self._apply_path_replacements(url)
        return url

    def _apply_special_processing_to_params(self, params: Dict[str, str]) -> Dict[str, str]:
        result = params.copy()
        if self._is_replay_mode(result):
            if result.get('livemode') == '1':
                result['livemode'] = '4'
            if 'playseek' in result and result.get('servicetype') == '1':
                result['servicetype'] = '3'
        return result

    def parse(self, params: Dict[str, str], raw_query_string: str = None) -> Dict[str, str]:
        socks5_param = params.get('socks5', '').strip()
        http_param = params.get('http', '').strip()
        base_url = params.get('u', '').strip()
        
        if not base_url: 
            return {"error": "缺少参数 u"}
        
        final_addr, final_type = self._resolve_proxy(base_url, socks5_param, http_param)

        try:
            base_url_decoded = urllib.parse.unquote(base_url)
        except:
            base_url_decoded = base_url

        u_base, u_internal_params = self._extract_params_from_u(base_url_decoded)
        u_base = self._fix_url_query(u_base)

        top_params = {k: v for k, v in params.items() if k and k not in ['socks5', 'http', 'u', 'url']}
        merged_params = {**top_params, **u_internal_params}
        merged_params = self._apply_special_processing_to_params(merged_params)
        target_base = self._apply_special_processing_to_url(u_base, merged_params)

        query_parts = []
        for k, v in merged_params.items():
            query_parts.append(f"{k}={urllib.parse.quote_plus(v, safe=':/,')}")
        target_url_final = target_base + (('&' if '?' in target_base else '?') + '&'.join(query_parts) if query_parts else "")

        encoded_replaced_base = urllib.parse.quote(target_base, safe='')
        proxy_encoded_params = []
        
        if final_type == 'socks5' and final_addr:
            proxy_encoded_params.append(f"socks5={urllib.parse.quote(final_addr, safe='')}")
        elif final_type == 'http' and final_addr:
            proxy_encoded_params.append(f"http={urllib.parse.quote(final_addr, safe='')}")
        
        proxy_encoded_params.append(f"u={encoded_replaced_base}")
        
        for k, v in merged_params.items():
            proxy_encoded_params.append(f"{k}={urllib.parse.quote_plus(v, safe='')}")
        
        proxy_url = f"{self.address}?{'&'.join(proxy_encoded_params)}"
        
        return {
            "url": proxy_url, 
            "Proxy": final_type + "=" + final_addr,
            "PlayURL": target_url_final
        }

    def proxy(self, url: str, headers: Dict[str, Any]) -> Tuple[Union[bytes, Iterable[bytes]], Dict[str, str]]:
        socket.getaddrinfo = getaddrinfo_ipv4_only
        
        session = self._create_session()
        
        try:
            parsed_url = urllib.parse.urlparse(url)
            qs = urllib.parse.parse_qs(parsed_url.query, keep_blank_values=True)
            
            socks5_param = qs.get('socks5', [''])[0]
            http_param = qs.get('http', [''])[0]
            base_url = qs.get('u', [''])[0]

            target = urllib.parse.unquote(base_url)
            u_base, u_internal_params = self._extract_params_from_u(target)
            u_base = self._fix_url_query(u_base)

            top_params = {k: urllib.parse.unquote(v[0]) for k, v in qs.items() if k and k not in ['socks5', 'http', 'u', 'url']}
            merged_params = {**top_params, **u_internal_params}
            merged_params = self._apply_special_processing_to_params(merged_params)
            target_base = self._apply_special_processing_to_url(u_base, merged_params)

            # 【修复】获取代理，传入当前代理用于重定向后沿用
            # 第一次请求时 current_proxy 为 None
            final_addr, final_type = self._resolve_proxy(target_base, socks5_param, http_param, None, None)

            if merged_params:
                query_parts = [f"{k}={urllib.parse.quote_plus(v, safe=':/,')}" for k, v in merged_params.items()]
                target_final = target_base + ('&' if '?' in target_base else '?') + '&'.join(query_parts)
            else:
                target_final = target_base

            r = session.get(
                target_final,
                proxies=self._get_proxy(final_addr, final_type),
                headers={k: v for k, v in headers.items() if k.lower() in ['range', 'user-agent']},
                timeout=15,
                verify=False,
                stream=True,
                allow_redirects=True
            )

            if r.status_code >= 400:
                return self._err(f"失败 {r.status_code}", r.status_code)

            final_url = r.url
            
            content_type = r.headers.get('Content-Type', '').lower()
            is_real_m3u8 = ('.m3u8' in final_url.lower()) or ('mpegurl' in content_type)

            if is_real_m3u8:
                # 【修复】重定向后沿用当前代理，不重新匹配规则
                # 注意：这里不调用 _resolve_proxy，直接使用 final_addr, final_type
                # 但需要检查重定向后的域名是否需要不同的代理类型（仅当当前代理为空时）
                if not final_addr or not final_type:
                    # 如果当前代理为空，尝试从重定向后的URL匹配规则
                    try:
                        parsed_final = urllib.parse.urlparse(final_url)
                        final_host = parsed_final.hostname
                        if final_host:
                            new_addr, new_type = match_proxy_rule(final_host)
                            if new_addr:
                                final_addr, final_type = new_addr, new_type
                    except Exception:
                        pass
                
                all_params = {}
                if final_type == 'socks5' and final_addr:
                    all_params['socks5'] = final_addr
                elif final_type == 'http' and final_addr:
                    all_params['http'] = final_addr
                all_params.update(merged_params)
                
                b = self._rewrite_m3u8(r.text, final_url, final_addr, final_type, all_params).encode('utf-8')
                h = {
                    'Content-Type': 'application/vnd.apple.mpegurl',
                    'Content-Length': str(len(b)),
                    'Cache-Control': 'no-cache'
                }
                return b, self._add_common_headers(h, r.status_code)
            else:
                h = {
                    'Content-Type': r.headers.get('Content-Type', 'video/mp2t'),
                    **{k: v for k, v in r.headers.items() if k.lower() in ['content-length', 'content-range', 'transfer-encoding']}
                }
                return r.iter_content(chunk_size=8192), self._add_common_headers(h, r.status_code)

        except Exception as e:
            return self._err(f"错误: {str(e)}", 500)
        finally:
            session.close()
            socket.getaddrinfo = original_getaddrinfo

    def _rewrite_m3u8(self, content: str, base_url: str, proxy_addr: str, proxy_type: str, original_params: Dict[str, str]) -> str:
        if not content.strip():
            return content
        
        url_parts = urllib.parse.urlparse(base_url)
        base_dir = base_url.rsplit('/', 1)[0] + '/'
        base_root = f"{url_parts.scheme}://{url_parts.netloc}"
        
        def rewrite_uri(match):
            uri_val = match.group(1)
            if uri_val.startswith(self.address):
                return f'URI="{uri_val}"'
            abs_u = self._to_abs(uri_val, base_root, base_dir)
            return f'URI="{self._wrap(abs_u, proxy_addr, proxy_type, original_params)}"'
        
        lines = []
        for line in content.splitlines():
            line = line.strip()
            if not line:
                continue
            
            if line.startswith("#") and 'URI="' in line:
                line = re.sub(r'URI="([^"]+)"', rewrite_uri, line)
                lines.append(line)
                continue
            
            if not line.startswith("#"):
                abs_uri = self._to_abs(line, base_root, base_dir)
                lines.append(self._wrap(abs_uri, proxy_addr, proxy_type, original_params))
            else:
                lines.append(line)
        
        return "\n".join(lines)

    def _to_abs(self, uri: str, root: str, dir_path: str) -> str:
        if uri.startswith(("http://", "https://")):
            return uri
        if uri.startswith("/"):
            return f"{root}{uri}"
        return urllib.parse.urljoin(dir_path, uri)

    def _wrap(self, target: str, proxy_addr: str, proxy_type: str, params: Dict[str, str]) -> str:
        processed = self._apply_special_processing_to_url(target, params)
        p_parts = []
        
        if proxy_type == 'socks5' and proxy_addr:
            p_parts.append(f"socks5={urllib.parse.quote(proxy_addr)}")
        elif proxy_type == 'http' and proxy_addr:
            p_parts.append(f"http={urllib.parse.quote(proxy_addr)}")
        
        p_parts.append(f"u={urllib.parse.quote(processed, safe='')}")
        
        for k, v in params.items():
            if k not in ['socks5', 'http', 'u']:
                p_parts.append(f"{k}={urllib.parse.quote_plus(v, safe='')}")
        
        return f"{self.address}?{'&'.join(p_parts)}"

    def _add_common_headers(self, headers: Dict[str, str], status: int) -> Dict[str, str]:
        headers.update({
            "Access-Control-Allow-Origin": "*",
            "X-Proxy-Status-Code": str(status)
        })
        return headers

    def _err(self, msg: str, status_code: int = 500) -> Tuple[bytes, Dict[str, str]]:
        b = f"[Error] {msg}".encode('utf-8')
        return b, self._add_common_headers({
            "Content-Type": "text/plain",
            "Content-Length": str(len(b))
        }, status_code)

    def stop(self):
        pass

    def __del__(self):
        pass