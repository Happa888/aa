
import json
import time
import os
import sys
from typing import Set
from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from webdriver_manager.chrome import ChromeDriverManager
from selenium.webdriver.chrome.service import Service

BASE = 'https://dm.takaratomy.co.jp'
PAGE_URL = 'https://dm.takaratomy.co.jp/card/?v=%7B%22suggest%22:%22on%22,%22keyword_type%22:[%22card_name%22,%22card_ruby%22,%22card_text%22],%22culture_cond%22:[%22%E5%8D%98%E8%89%B2%22,%22%E5%A4%9A%E8%89%B2%22],%22pagenum%22:%22{}%22,%22samename%22:%22show%22,%22sort%22:%22release_new%22%7D'

DEFAULT_START = 1
DEFAULT_END = 420  # 全カード分（2025年時点で400ページ超、必要に応じて増減）
RETRY_LIMIT = 3
SLEEP_BETWEEN_PAGES = 0.1  # 高速化
SLEEP_BETWEEN_CARDS = 0.05


def collect_names(start: int, end: int, mode: str = 'detail') -> Set[str]:
    out_path = 'public/cardnames.json'
    # 既存データがあれば読み込んでレジューム
    if os.path.exists(out_path):
        try:
            with open(out_path, 'r', encoding='utf-8') as f:
                names = set(json.load(f))
            print(f'[resume] 既存データ {len(names)}件から再開')
        except Exception:
            names = set()
    else:
        names = set()

    chrome_options = Options()
    chrome_options.add_argument('--headless=new')
    chrome_options.add_argument('--no-sandbox')
    chrome_options.add_argument('--disable-gpu')
    chrome_options.add_argument('--window-size=1280,2000')

    service = Service(ChromeDriverManager().install())
    driver = webdriver.Chrome(service=service, options=chrome_options)
    wait = WebDriverWait(driver, 15)

    def clean(items: Set[str]) -> Set[str]:
        blacklist = [
            'Error', '503', 'Backend fetch failed', 'Not Found', 'html', 'DOCTYPE',
            'Service Unavailable', 'nginx', 'Gateway', 'Forbidden', 'Cloudflare'
        ]
        return set(
            n for n in items
            if n and not any(bad in n for bad in blacklist)
        )

    def save_union(current: Set[str]):
        # 既存ファイルとユニオンし、原子的に置換
        merged: Set[str] = set(current)
        try:
            if os.path.exists(out_path):
                with open(out_path, 'r', encoding='utf-8') as rf:
                    existing = set(json.load(rf))
                merged |= existing
        except Exception:
            pass
        merged = clean(merged)
        tmp = out_path + '.tmp'
        with open(tmp, 'w', encoding='utf-8') as wf:
            json.dump(sorted(merged), wf, ensure_ascii=False, indent=2)
        os.replace(tmp, out_path)
        print(f'    [save] {len(merged)}件（union保存）')

    for page in range(start, end + 1):
        url = PAGE_URL.format(page)
        print(f'Open list: {url}')
        for retry in range(RETRY_LIMIT):
            chrome_options = Options()
            chrome_options.add_argument('--headless=new')
            chrome_options.add_argument('--no-sandbox')
            chrome_options.add_argument('--disable-gpu')
            chrome_options.add_argument('--window-size=1280,2000')
            chrome_options.add_argument('--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36')
            service = Service(ChromeDriverManager().install())
            driver = webdriver.Chrome(service=service, options=chrome_options)
            wait = WebDriverWait(driver, 15)
            try:
                driver.get(url)
                wait.until(EC.presence_of_all_elements_located((By.CSS_SELECTOR, 'a[href*="/card/detail/?id="]')))
                links = driver.find_elements(By.CSS_SELECTOR, 'a[href*="/card/detail/?id="]')
                hrefs = []
                for a in links:
                    href = a.get_attribute('href')
                    if href and '/card/detail/?id=' in href:
                        hrefs.append(href)
                print(f'  found {len(hrefs)} detail links')
                if mode == 'fast':
                    # 一覧ページのリンクテキストから直接収集して高速化
                    for a in links:
                        try:
                            text = (a.text or '').strip()
                            if not text:
                                # 子要素に名前がある場合もあるためフォールバックでinnerTextを読む
                                text = (a.get_attribute('innerText') or '').strip()
                            if text:
                                name = text.split('(')[0].strip()
                                if name and not any(err in name for err in [
                                    'Error', '503', 'Backend fetch failed', 'Not Found', 'html', 'DOCTYPE', 'Service Unavailable', 'nginx', 'Gateway', 'Forbidden', 'Cloudflare', 'デュエル・マスターズ'
                                ]):
                                    names.add(name)
                        except Exception as e:
                            print(f'    skip list-text: {e}')
                else:
                    # 従来の詳細ページ巡回（精度優先）
                    import re
                    for i, href in enumerate(hrefs):
                        try:
                            driver.get(href)
                            wait.until(EC.presence_of_element_located((By.CSS_SELECTOR, 'h3, h1')))
                            text = ''
                            # 1. meta og:title
                            metas = driver.find_elements(By.CSS_SELECTOR, 'meta[property="og:title"]')
                            if metas:
                                content = metas[0].get_attribute('content') or ''
                                if content:
                                    text = content.strip()
                            # 2. h3, h1, .cardname, .product_name, .detailHeader h1
                            if not text:
                                for sel in ['h3', 'h1', '.cardname', '.product_name', '.detailHeader h1']:
                                    els = driver.find_elements(By.CSS_SELECTOR, sel)
                                    if els:
                                        cand = els[0].text.strip()
                                        if cand:
                                            text = cand
                                            break
                            # 3. h3のinnerTextから「カード名(セット名/番号)」形式を正規表現で抽出
                            if not text:
                                h3s = driver.find_elements(By.CSS_SELECTOR, 'h3')
                                for h3 in h3s:
                                    t = h3.text.strip()
                                    m = re.match(r'^(.+?)\s*\(', t)
                                    if m:
                                        text = m.group(1).strip()
                                        break
                            # 4. それでも取れなければbodyのinnerTextから「(DM」などで分割して先頭を使う
                            if not text:
                                body = driver.find_element(By.TAG_NAME, 'body')
                                t = body.text.strip()
                                m = re.match(r'^(.+?)\s*\(DM', t)
                                if m:
                                    text = m.group(1).strip()
                            # 5. ()区切りでカード名部分だけ抽出
                            name = ''
                            if text:
                                name = text.split('(')[0].strip()
                            # 6. エラー応答や不自然な値を除外
                            if name and not any(
                                err in name for err in [
                                    'Error', '503', 'Backend fetch failed', 'Not Found', 'html', 'DOCTYPE', 'Service Unavailable', 'nginx', 'Gateway', 'Forbidden', 'Cloudflare', 'デュエル・マスターズ']
                            ):
                                names.add(name)
                            time.sleep(SLEEP_BETWEEN_CARDS)
                        except Exception as e:
                            print(f'    skip {href}: {e}')
                # ページごとに一時保存（既存とunionで安全保存）
                save_union(names)
                print(f'  [page {page}] 一時保存（union）: {len(names)}件')
                time.sleep(SLEEP_BETWEEN_PAGES)
                driver.quit()
                break  # retryループを抜けて次のページへ
            except Exception as e:
                print(f'  retry {retry+1}/{RETRY_LIMIT} page {page}: {e}')
                driver.quit()
                if retry == RETRY_LIMIT - 1:
                    print(f'  skip page {page} after {RETRY_LIMIT} retries')
                else:
                    time.sleep(2)
    # 最終保存
    # 最終保存もunionで上書きロスト防止
    save_union(names)
    # 読み直して件数表示
    try:
        with open(out_path, 'r', encoding='utf-8') as rf:
            final_list = json.load(rf)
        print(f'  [finally] 最終保存: {len(final_list)}件')
    except Exception:
        final_list = sorted(list(clean(names)))
        print(f'  [finally] 最終保存(backup算出): {len(final_list)}件')
    return set(final_list)


if __name__ == '__main__':
    # 使い方: python get_dm_cardnames_selenium.py 1 100 fast
    # 第3引数に 'fast' を指定すると一覧ページのみで収集（超高速/やや不完全の可能性）
    if len(sys.argv) >= 3:
        start = int(sys.argv[1])
        end = int(sys.argv[2])
        mode = (sys.argv[3] if len(sys.argv) >= 4 else 'detail').lower()
    else:
        start = DEFAULT_START
        end = DEFAULT_END
        mode = 'detail'
    print(f'ページ範囲: {start}～{end} で取得開始（mode={mode}）')
    result = collect_names(start, end, mode)
    print(f'Collected names: {len(result)}')
    # public/cardnames.json に保存
    out_path = 'public/cardnames.json'
    with open(out_path, 'w', encoding='utf-8') as f:
        json.dump(sorted(result), f, ensure_ascii=False, indent=2)
    print(f'Wrote {out_path}')
