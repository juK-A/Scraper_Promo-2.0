# /mercado_livre_scraper/app/services.py

import os
from dotenv import load_dotenv
import requests
import uuid
from PIL import Image
from io import BytesIO
from .database import supabase # Importa o cliente do módulo database

load_dotenv()

USER_AGENT = os.getenv("USER_AGENT")
WEBHOOK_URL = os.getenv("WEBHOOK_URL")

headers = {'User-Agent': USER_AGENT}

def processar_imagem_para_quadrado(url_imagem, tamanho_saida=(500, 500), cor_fundo=(255, 255, 255)):
    """Baixa e processa a imagem para o formato quadrado. Retorna os bytes."""
    try:
        if not url_imagem:
            return None
        response = requests.get(url_imagem, headers=headers, timeout=15)
        response.raise_for_status()
        img_original = Image.open(BytesIO(response.content))

        if img_original.mode in ('RGBA', 'P', 'LA'):
            fundo = Image.new('RGB', img_original.size, cor_fundo)
            fundo.paste(img_original, (0, 0), img_original.convert('RGBA'))
            img = fundo
        else:
            img = img_original.convert('RGB')

        img.thumbnail(tamanho_saida, Image.Resampling.LANCZOS)
        img_quadrada = Image.new('RGB', tamanho_saida, cor_fundo)
        pos_x = (tamanho_saida[0] - img.width) // 2
        pos_y = (tamanho_saida[1] - img.height) // 2
        img_quadrada.paste(img, (pos_x, pos_y))

        buffer = BytesIO()
        img_quadrada.save(buffer, format='JPEG', quality=90)
        buffer.seek(0)
        
        return buffer.getvalue()

    except Exception as e:
        print(f"ERRO AO PROCESSAR IMAGEM: {e}")
        return None

def upload_imagem_processada(image_bytes, bucket_name='imagens-produtos'):
    """Faz o upload dos bytes de uma imagem para o Supabase Storage."""
    try:
        file_name = f"processed_{uuid.uuid4()}.jpg"
        supabase.storage.from_(bucket_name).upload(file=image_bytes, path=file_name, file_options={"content-type": "image/jpeg"})
        public_url_data = supabase.storage.from_(bucket_name).get_public_url(file_name)
        
        return public_url_data
    except Exception as e:
        print(f"ERRO NO UPLOAD PARA O SUPABASE STORAGE: {e}")
        return None

def enviar_para_webhook(payload):
    """Envia um payload para o webhook configurado."""
    return requests.post(
        WEBHOOK_URL,
        json=payload,
        headers={'Content-Type': 'application/json', 'User-Agent': 'Mercado-Livre-Scraper/1.0'},
        timeout=60
    )