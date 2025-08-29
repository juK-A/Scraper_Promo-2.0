# /mercado_livre_scraper/app/database.py

import os
from dotenv import load_dotenv
from supabase import create_client, Client
import datetime

# Carrega as variáveis de ambiente do arquivo .env
load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")

# Cria uma única instância do cliente Supabase para ser usada em todo o módulo
supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

def salvar_promocao(produto_dados, final_message=None, agendamento_data=None):
    """Salva os dados de uma promoção no Supabase."""
    try:
        if agendamento_data and isinstance(agendamento_data, datetime.datetime):
            agendamento_data = agendamento_data.isoformat()
        
        data_to_insert = {
            "titulo": produto_dados.get("titulo"),
            "preco_atual": produto_dados.get("preco_atual"),
            "preco_original": produto_dados.get("preco_original"),
            "desconto": produto_dados.get("desconto"),
            "link_produto": produto_dados.get("link"),
            "link_afiliado": produto_dados.get("afiliado_link"),
            "imagem_url": produto_dados.get("imagem"),
            "condicao": produto_dados.get("condicao"),
            "vendedor": produto_dados.get("vendedor"),
            "disponivel": produto_dados.get("disponivel"),
            "descricao": produto_dados.get("descricao"),
            "final_message": final_message,
            "agendamento": agendamento_data,
            "cupons": produto_dados.get("cupons", []),
            "processed_image_url": produto_dados.get("processed_image_url")
        }
        
        supabase.table("promocoes_beauty").insert(data_to_insert).execute()
        print("DEBUG: Dados salvos no Supabase.")
        return True
        
    except Exception as e:
        print(f"--- ERRO AO SALVAR NO SUPABASE ---: {e}")
        return False

def listar_produtos_db(status_filter, ordem_order):
    """Lista produtos do Supabase com base nos filtros."""
    query = supabase.table("promocoes_beauty").select("*")
    if status_filter == 'agendado':
        query = query.not_.is_("agendamento", "null")
        query = query.order("agendamento", desc=(ordem_order == 'desc'))
    elif status_filter == 'nao-agendado':
        query = query.is_("agendamento", "null")
        query = query.order("created_at", desc=(ordem_order == 'desc'))
    else: # 'todos'
        query = query.order("created_at", desc=(ordem_order == 'desc'))

    response = query.execute()
    return response.data

def deletar_produto_db(produto_id):
    """Deleta um produto do Supabase pelo ID."""
    return supabase.table("promocoes_beauty").delete().eq("id", produto_id).execute()

def agendar_produto_db(produto_id, agendamento_iso):
    """Atualiza o agendamento de um produto no Supabase."""
    return supabase.table("promocoes_beauty").update({'agendamento': agendamento_iso}).eq("id", produto_id).execute()

def obter_produto_db(produto_id):
    """Busca um produto específico no Supabase pelo ID."""
    try:
        response = supabase.table("promocoes_beauty").select("*").eq("id", produto_id).execute()
        if response.data and len(response.data) > 0:
            return response.data[0]
        return None
    except Exception as e:
        print(f"Erro ao buscar produto no Supabase: {e}")
        return None

def atualizar_produto_db(produto_id, dados_atualizacao):
    """Atualiza dados específicos de um produto no Supabase."""
    return supabase.table("promocoes_beauty").update(dados_atualizacao).eq("id", produto_id).execute()