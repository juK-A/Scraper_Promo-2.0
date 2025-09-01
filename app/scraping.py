# /mercado_livre_scraper/app/scraping.py

import os
from dotenv import load_dotenv
import requests
from bs4 import BeautifulSoup
import time
import re

load_dotenv()
USER_AGENT = os.getenv("USER_AGENT")
headers = {'User-Agent': USER_AGENT}

def extrair_imagem_produto(produto_elem):
    imagem_url = ""
    try:
        imagem_selectors = ['img.ui-search-result-image__element', 'img[data-src]', 'img[src]', '.ui-search-result-image img', '.ui-search-item__image img', 'figure img', '.poly-card__portada img']
        for selector in imagem_selectors:
            img_elem = produto_elem.select_one(selector)
            if img_elem:
                src = img_elem.get('data-src') or img_elem.get('src')
                if src and 'http' in src:
                    imagem_url = src.split('?')[0] if '?' in src else src
                    break
        if not imagem_url:
            all_images = produto_elem.select('img')
            for img in all_images:
                src = img.get('data-src') or img.get('src')
                if src and 'http' in src and any(ext in src.lower() for ext in ['.jpg', '.jpeg', '.png', '.webp']):
                    imagem_url = src.split('?')[0] if '?' in src else src
                    break
    except Exception:
        pass
    return imagem_url

def extrair_precos(produto_elem):
    precos_info={'preco_atual':'Preço não disponível','preco_original':None,'desconto':None,'tem_promocao':False}
    try:
        desconto_selectors=['.ui-search-price__discount','.price-tag-discount','.ui-search-item__discount-text','.andes-money-amount--previous','[class*="discount"]','.andes-money-amount__discount','.ui-search-price__second-line--discount','[data-testid="discount"]']
        desconto=None;tem_promocao=False
        for selector in desconto_selectors:
            desconto_elem=produto_elem.select_one(selector)
            if desconto_elem:
                texto_desconto=desconto_elem.get_text().strip();match=re.search(r'(\d+%)',texto_desconto)
                if match:desconto=int(match.group(1).replace('%', ''));tem_promocao=True;break
        preco_original_selectors=['.ui-search-price__original-value .andes-money-amount__fraction','.ui-search-price__part--original .andes-money-amount__fraction','.price-tag-text-line .andes-money-amount__fraction','s .andes-money-amount__fraction','.ui-search-price__part--strikethrough .andes-money-amount__fraction','.ui-search-price__original-value','.andes-money-amount--previous .andes-money-amount__fraction','[data-testid="price-original"] .andes-money-amount__fraction']
        preco_original=None
        for selector in preco_original_selectors:
            preco_elem=produto_elem.select_one(selector)
            if preco_elem:
                preco_original=preco_elem.get_text().strip()
                if re.search(r'\d',preco_original):tem_promocao=True;break
                else:preco_original=None
        preco_atual_selectors=['.andes-money-amount__fraction','.ui-search-price__second-line .andes-money-amount__fraction','.ui-search-price__part--medium .andes-money-amount__fraction','.ui-search-price__part:not(.ui-search-price__original-value):not(.ui-search-price__part--original) .andes-money-amount__fraction','span.price-tag-symbol + span.price-tag-fraction','.price-tag-fraction','[data-testid="price"] .andes-money-amount__fraction']
        preco_atual=None
        for selector in preco_atual_selectors:
            preco_elems=produto_elem.select(selector)
            for preco_elem in preco_elems:
                preco_texto=preco_elem.get_text().strip()
                if re.search(r'\d',preco_texto):
                    elemento_pai=preco_elem.parent;classes_pai=' '.join(elemento_pai.get('class',[])if elemento_pai else[])
                    if('original'not in classes_pai.lower()and'strikethrough'not in classes_pai.lower()and'previous'not in classes_pai.lower()):preco_atual=preco_texto;break
            if preco_atual:break
        if not preco_atual:
            all_price_elements=produto_elem.select('[class*="money-amount"] [class*="fraction"]')
            for elem in all_price_elements:
                parent_classes=' '.join(elem.parent.get('class',[])if elem.parent else[]);grandparent_classes=' '.join(elem.parent.parent.get('class',[])if elem.parent and elem.parent.parent else[])
                if('original'not in parent_classes.lower()and'strikethrough'not in parent_classes.lower()and'original'not in grandparent_classes.lower()and'strikethrough'not in grandparent_classes.lower()and'previous'not in parent_classes.lower()):
                    preco_texto=elem.get_text().strip()
                    if re.search(r'\d',preco_texto):preco_atual=preco_texto;break
        if preco_atual:
            centavos_elem=produto_elem.select_one('.andes-money-amount__cents')
            if centavos_elem and centavos_elem.get_text().strip():centavos=centavos_elem.get_text().strip();precos_info['preco_atual']=f"R$ {preco_atual},{centavos}"
            else:precos_info['preco_atual']=f"R$ {preco_atual}"
        if tem_promocao and preco_original:
            centavos_original=produto_elem.select_one('.ui-search-price__original-value .andes-money-amount__cents')
            if centavos_original and centavos_original.get_text().strip():centavos=centavos_original.get_text().strip();precos_info['preco_original']=f"R$ {preco_original},{centavos}"
            else:
                preco_limpo=re.sub(r'[^\d,]', '', preco_original)
                if preco_limpo:precos_info['preco_original']=f"R$ {preco_limpo}"
                else:precos_info['preco_original']=f"R$ {preco_original}"
        precos_info['desconto']=desconto;precos_info['tem_promocao']=tem_promocao
    except Exception as e:print(f"DEBUG PRECOS: Erro ao extrair preços: {e}");pass
    return precos_info

def scrape_mercadolivre(produto, max_pages=3):
    produto_formatado = produto.replace(' ', '+')
    resultados = []
    for page in range(max_pages):
        try:
            offset = page * 50
            url_final = f'https://lista.mercadolivre.com.br/{produto_formatado}_Desde_{offset + 1}'
            r = requests.get(url_final, headers=headers, timeout=15)
            if r.status_code != 200:
                break
            site = BeautifulSoup(r.content, 'html.parser')
            selectors_to_try = [
                'div.ui-search-result__content', 'div.ui-search-result', 'ol.ui-search-results li',
                'div.poly-card__content', 'article.ui-search-result', '.ui-search-results .ui-search-result',
                'li.ui-search-layout__item', '.shops__search-result', '.ui-search-result__wrapper'
            ]
            produtos_encontrados = []
            for selector in selectors_to_try:
                produtos_encontrados = site.select(selector)
                if produtos_encontrados:
                    break
            if not produtos_encontrados:
                break
            for i, produto_elem in enumerate(produtos_encontrados):
                try:
                    titulo = None
                    titulo_selectors = [
                        'h2.ui-search-item__title', '.ui-search-item__title', 'a.ui-search-link',
                        '.poly-component__title', 'h2[class*="ui-search"]', '.ui-search-item__title a',
                        'a[class*="ui-search-link"]', 'h2', 'h3'
                    ]
                    for titulo_sel in titulo_selectors:
                        titulo_elem = produto_elem.select_one(titulo_sel)
                        if titulo_elem:
                            titulo = titulo_elem.get_text().strip()
                            if titulo and len(titulo) > 10:
                                break
                    if not titulo or len(titulo) < 10:
                        continue
                    precos_info = extrair_precos(produto_elem)
                    imagem_url = extrair_imagem_produto(produto_elem)
                    link_selectors = [
                        'a[href*="/p/"]', 'a[href*="/MLA"]', 'a[href*="/MLB"]', 'a.ui-search-link', 'h2 a', 'a[href]'
                    ]
                    link = "#"
                    for link_sel in link_selectors:
                        link_elem = produto_elem.select_one(link_sel)
                        if link_elem:
                            href = link_elem.get('href')
                            if href and ('/p/' in href or '/ML' in href):
                                link = href
                                break
                    if link and not link.startswith('http'):
                        link = 'https://mercadolivre.com.br' + link
                    if titulo and titulo != "Título não encontrado":
                        produto_dados = {
                            'titulo': titulo, 'preco_atual': precos_info['preco_atual'],
                            'preco_original': precos_info['preco_original'], 'desconto': precos_info['desconto'],
                            'tem_promocao': precos_info['tem_promocao'], 'imagem': imagem_url, 'link': link
                        }
                        resultados.append(produto_dados)
                except Exception:
                    continue
            time.sleep(2)
        except Exception:
            break
    return resultados

def scrape_produto_especifico(url):
    try:
        r = requests.get(url, headers=headers, timeout=15)
        if r.status_code != 200:
            return None
        site = BeautifulSoup(r.content, 'html.parser')
        produto_info = {
            'titulo': 'Produto não encontrado', 'preco_atual': 'Preço não disponível',
            'preco_original': None, 'desconto': None, 'tem_promocao': False,
            'imagem': '', 'descricao': '', 'vendedor': '', 'condicao': '',
            'disponivel': False, 'cupons': [], 'link': url
        }
        titulo_selectors = ['h1.ui-pdp-title', 'h1[class*="title"]', '.ui-pdp-title', 'h1', '[data-testid="product-title"]']
        for selector in titulo_selectors:
            titulo_elem = site.select_one(selector)
            if titulo_elem:
                produto_info['titulo'] = titulo_elem.get_text().strip()
                break
        try:
            imagem_selectors = [
                '.ui-pdp-gallery__figure img', '.ui-pdp-image img', '[data-testid="product-image"] img',
                '.gallery-image img', 'img[class*="pdp"]', '.ui-pdp-gallery .slick-slide img',
                '.ui-pdp-media img', 'figure img[src]', 'img[data-src]'
            ]
            for selector in imagem_selectors:
                img_elem = site.select_one(selector)
                if img_elem:
                    src = img_elem.get('src') or img_elem.get('data-src')
                    if src and 'http' in src:
                        if '_' in src and 'I.jpg' in src:
                            src = src.replace('_I.jpg', '_O.jpg')
                        elif '?' in src:
                            src = src.split('?')[0]
                        produto_info['imagem'] = src
                        break
            if not produto_info['imagem']:
                all_images = site.select('img')
                for img in all_images:
                    src = img.get('src') or img.get('data-src')
                    if src and 'http' in src:
                        if any(term in src.lower() for term in ['http://http2.mlstatic.com', 'mlstatic.com', 'mla']):
                            if any(ext in src.lower() for ext in ['.jpg', '.jpeg', '.png', '.webp']):
                                if '?' in src:
                                    src = src.split('?')[0]
                                produto_info['imagem'] = src
                                break
        except Exception:
            pass
        try:
            desconto_selectors = [
                '.ui-pdp-price__discount', '.price-tag-discount', '[class*="discount"]',
                '.ui-pdp-media__discount', '.andes-money-amount__discount'
            ]
            desconto = None
            tem_promocao = False
            for selector in desconto_selectors:
                desconto_elem = site.select_one(selector)
                if desconto_elem:
                    texto_desconto = desconto_elem.get_text().strip()
                    match = re.search(r'(\d+%)', texto_desconto)
                    if match:
                        desconto = int(match.group(1).replace('%', ''))
                        tem_promocao = True
                        break
            preco_original_selectors = [
                '.ui-pdp-price__original-value .andes-money-amount__fraction',
                '.ui-pdp-price__part--original .andes-money-amount__fraction',
                's .andes-money-amount__fraction', '.price-tag-text-line .andes-money-amount__fraction',
                '.andes-money-amount--previous .andes-money-amount__fraction', '.ui-pdp-price__original-value',
                '[class*="original"] .andes-money-amount__fraction'
            ]
            preco_original = None
            for selector in preco_original_selectors:
                preco_elem = site.select_one(selector)
                if preco_elem:
                    preco_original_texto = preco_elem.get_text().strip()
                    if re.search(r'\d', preco_original_texto):
                        preco_original = preco_original_texto
                        tem_promocao = True
                        break
            preco_atual_selectors = [
                '.ui-pdp-price__second-line .andes-money-amount__fraction',
                '.ui-pdp-price__part:not(.ui-pdp-price__original-value) .andes-money-amount__fraction',
                '[class*="price"]:not([class*="original"]) .andes-money-amount__fraction', '.price-tag-fraction',
                '[data-testid="price-part"]'
            ]
            preco_atual_encontrado = False
            for selector in preco_atual_selectors:
                preco_elem = site.select_one(selector)
                if preco_elem:
                    preco_texto = preco_elem.get_text().strip()
                    if re.search(r'\d', preco_texto):
                        elemento_pai = preco_elem.parent
                        if elemento_pai and ('original' not in elemento_pai.get('class', []) and 'strikethrough' not in str(elemento_pai.get('class', []))):
                            centavos_elem = site.select_one('.andes-money-amount__cents')
                            if centavos_elem and centavos_elem.get_text().strip():
                                centavos = centavos_elem.get_text().strip()
                                produto_info['preco_atual'] = f"R$ {preco_texto},{centavos}"
                            else:
                                produto_info['preco_atual'] = f"R$ {preco_texto}"
                            preco_atual_encontrado = True
                            break
            if not preco_atual_encontrado:
                all_price_elements = site.select('.andes-money-amount__fraction')
                for elem in all_price_elements:
                    parent_classes = ' '.join(elem.parent.get('class', []) if elem.parent else [])
                    grandparent_classes = ' '.join(elem.parent.parent.get('class', []) if elem.parent and elem.parent.parent else [])
                    if ('original' not in parent_classes.lower() and 'strikethrough' not in parent_classes.lower() and
                        'original' not in grandparent_classes.lower() and 'strikethrough' not in grandparent_classes.lower()):
                        preco_texto = elem.get_text().strip()
                        if re.search(r'\d', preco_texto):
                            centavos_elem = site.select_one('.andes-money-amount__cents')
                            if centavos_elem and centavos_elem.get_text().strip():
                                centavos = centavos_elem.get_text().strip()
                                produto_info['preco_atual'] = f"R$ {preco_texto},{centavos}"
                            else:
                                produto_info['preco_atual'] = f"R$ {preco_texto}"
                            preco_atual_encontrado = True
                            break
            if tem_promocao and preco_original:
                centavos_original = site.select_one('.ui-pdp-price__original-value .andes-money-amount__cents')
                if centavos_original and centavos_original.get_text().strip():
                    centavos = centavos_original.get_text().strip()
                    produto_info['preco_original'] = f"R$ {preco_original},{centavos}"
                else:
                    preco_limpo = re.sub(r'[^\d,]', '', preco_original)
                    if preco_limpo:
                        produto_info['preco_original'] = f"R$ {preco_limpo}"
                    else:
                        produto_info['preco_original'] = f"R$ {preco_original}"
            produto_info['desconto'] = desconto
            produto_info['tem_promocao'] = tem_promocao
        except Exception:
            pass
        condicao_selectors = ['.ui-pdp-subtitle', '[class*="condition"]', '.ui-pdp-header__subtitle']
        for selector in condicao_selectors:
            condicao_elem = site.select_one(selector)
            if condicao_elem:
                texto = condicao_elem.get_text().strip()
                if 'novo' in texto.lower() or 'usado' in texto.lower() or 'recondicionado' in texto.lower():
                    produto_info['condicao'] = texto
                    break
        vendedor_selectors = ['.ui-pdp-seller__header__title', '[class*="seller"] a', '.seller-name']
        for selector in vendedor_selectors:
            vendedor_elem = site.select_one(selector)
            if vendedor_elem:
                produto_info['vendedor'] = vendedor_elem.get_text().strip()
                break
        disponivel_selectors = ['.ui-pdp-buybox__quantity__available', '[class*="stock"]', '[class*="available"]']
        for selector in disponivel_selectors:
            disp_elem = site.select_one(selector)
            if disp_elem:
                texto_disponivel = disp_elem.get_text().strip().lower()
                produto_info['disponivel'] = bool(texto_disponivel and 'disponível' in texto_disponivel)
                break
        desc_selectors = ['.ui-pdp-description__content p', '.item-description p', '[class*="description"] p']
        for selector in desc_selectors:
            desc_elem = site.select_one(selector)
            if desc_elem:
                descricao = desc_elem.get_text().strip()
                produto_info['descricao'] = descricao[:300] + '...' if len(descricao) > 300 else descricao
                break
        
        cupom_selectors = [
            '.ui-pdp-coupon-banner', '.ui-pdp-offers-banner', '.ui-pdp-promotions__container',
            '[data-testid*="coupon-banner"]', '.andes-message', '.ui-pdp-offers-badge'
        ]
        cupons_encontrados = []
        for selector in cupom_selectors:
            banners = site.select(selector)
            for banner in banners:
                texto = banner.get_text().strip()
                if texto and any(term in texto.lower() for term in ['cupom', 'desconto', 'oferta']):
                    cupons_encontrados.append(re.sub(r'\s+', ' ', texto))
        produto_info['cupons'] = list(set(cupons_encontrados))
        return produto_info
    except Exception:
        return None

def busca_alternativa(produto):
    try:
        produto_formatado = produto.replace(' ', '%20')
        url = f'https://lista.mercadolivre.com.br/{produto_formatado}'
        r = requests.get(url, headers=headers, timeout=15)
        if r.status_code == 200:
            site = BeautifulSoup(r.content, 'html.parser')
            links = site.find_all('a', href=True)
            resultados = []
            for link in links:
                href = link.get('href', '')
                if ('/p/' in href or '/MLA' in href or '/MLB' in href) and len(resultados) < 10:
                    titulo = link.get_text().strip()
                    if len(titulo) > 10 and 'compartilhar' not in titulo.lower():
                        resultados.append({
                            'titulo': titulo, 'preco_atual': 'Consultar no site', 'preco_original': None,
                            'desconto': None, 'tem_promocao': False, 'imagem': '',
                            'link': href if href.startswith('http') else 'https://mercadolivre.com.br' + href
                        })
            return resultados
        else:
            return []
    except Exception:
        return []