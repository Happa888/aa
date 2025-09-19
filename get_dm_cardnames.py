import requests
from bs4 import BeautifulSoup
import time
import csv

BASE_URL = 'https://dm.takaratomy.co.jp'
PAGE_URL = 'https://dm.takaratomy.co.jp/card/?v=%7B%22suggest%22:%22on%22,%22keyword_type%22:[%22card_name%22,%22card_ruby%22,%22card_text%22],%22culture_cond%22:[%22%E5%8D%98%E8%89%B2%22,%22%E5%A4%9A%E8%89%B2%22],%22pagenum%22:%22{}%22,%22samename%22:%22show%22,%22sort%22:%22release_new%22%7D'

START_PAGE = 1
END_PAGE = 2  # テスト用。全件取得時は300程度に変更

cardnames = set()

for page in range(START_PAGE, END_PAGE+1):
    url = PAGE_URL.format(page)
    print(f'Fetching: {url}')
    res = requests.get(url)
    soup = BeautifulSoup(res.text, 'html.parser')
    # 一覧から詳細ページURLを取得
    for a in soup.find_all('a', href=True):
        href = a['href']
        if href.startswith('/card/detail/?id='):
            detail_url = BASE_URL + href
            # 詳細ページでカード名を取得
            try:
                detail_res = requests.get(detail_url)
                detail_soup = BeautifulSoup(detail_res.text, 'html.parser')
                # カード名はh1タグ等で取得できる場合が多い
                h1 = detail_soup.find('h1')
                if h1:
                    name = h1.get_text(strip=True)
                    if name:
                        cardnames.add(name)
                time.sleep(0.5)
            except Exception as e:
                print(f'Error: {e} ({detail_url})')
    time.sleep(1)

with open('dm_cardnames.csv', 'w', encoding='utf-8', newline='') as f:
    writer = csv.writer(f)
    for name in sorted(cardnames):
        writer.writerow([name])

print(f'取得完了: {len(cardnames)}件')
