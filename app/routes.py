# /mercado_livre_scraper/app/routes.py

from flask import Blueprint, render_template, request, jsonify
import datetime
import pytz
import time
import requests # Adicionado para tratar exceções de request
import os

# Importa as funções dos outros módulos
from . import scraping, services, database

main_bp = Blueprint('main', __name__)

@main_bp.route('/')
def index():
    return render_template('index.html')

@main_bp.route('/teste')
def teste():
    return jsonify({'status': 'funcionando', 'mensagem': 'Flask está rodando!'})

@main_bp.route('/buscar', methods=['POST'])
def buscar():
    try:
        data = request.get_json()
        produto = data.get('produto', '').strip()
        if not produto:
            return jsonify({'error': 'Produto não pode estar vazio'}), 400
        max_pages = data.get('max_pages', 2)
        # Chama a função de scraping
        resultados = scraping.scrape_mercadolivre(produto, max_pages)
        if not resultados:
            resultados = scraping.busca_alternativa(produto)
        return jsonify({'success': True, 'resultados': resultados, 'total': len(resultados)})
    except Exception as e:
        return jsonify({'error': f'Erro interno: {str(e)}'}), 500

@main_bp.route('/produto', methods=['POST'])
def buscar_produto():
    try:
        data = request.get_json()
        url = data.get('url', '').strip()
        if not url:
            return jsonify({'error': 'URL não pode estar vazia'}), 400
        if 'mercadolivre.com' not in url and 'mercadolibre.com' not in url:
            return jsonify({'error': 'URL deve ser do Mercado Livre'}), 400
        
        produto = scraping.scrape_produto_especifico(url)

        if produto:
            return jsonify({'success': True, 'produto': produto})
        else:
            return jsonify({'error': 'Não foi possível extrair informações do produto'}), 404
    except Exception as e:
        return jsonify({'error': f'Erro interno: {str(e)}'}), 500

@main_bp.route('/webhook', methods=['POST'])
def enviar_webhook():
    try:
        data = request.get_json()
        tipo = data.get('type', 'mensagem')
        afiliado_link = data.get('afiliado_link', '').strip()
        
        payload = {} # Inicia o payload
        produto_para_salvar = {}

        if tipo == 'mensagem':
            message = data.get('message', '').strip()
            if not message:
                return jsonify({'error': 'Mensagem não pode estar vazia'}), 400
            payload = {
                "command": "Mensagem", "message": message,
                "timestamp": time.time(), "source": "Mercado Livre Scraper"
            }
            
        elif tipo == 'produto':
            produto = data.get('produto', {})
            if not produto:
                return jsonify({'error': 'Dados do produto não podem estar vazios'}), 400
            
            produto_para_salvar = produto.copy() # Copia para evitar mutação
            
            # LÓGICA DE PROCESSAMENTO DE IMAGEM
            original_image_url = produto_para_salvar.get('imagem')
            if original_image_url:
                image_bytes = services.processar_imagem_para_quadrado(original_image_url)
                if image_bytes:
                    produto_para_salvar['processed_image_url'] = services.upload_imagem_processada(image_bytes)

            produto_para_salvar['afiliado_link'] = afiliado_link
            
            # LÓGICA PARA MONTAR O PAYLOAD (CORREÇÃO DO ERRO)
            promocao_info = ""
            if produto_para_salvar.get('tem_promocao'):
                promocao_info = f"""🔥 **PRODUTO EM PROMOÇÃO!**
💰 Preço Original: {produto_para_salvar.get('preco_original', 'N/A')}
💸 Preço Atual: {produto_para_salvar.get('preco_atual', 'N/A')}
🏷️ Desconto: {produto_para_salvar.get('desconto', 'N/A')}"""
            else:
                promocao_info = f"💵 Preço: {produto_para_salvar.get('preco_atual', 'N/A')}"
            
            detalhes_extras = [f"📦 Condição: {c}" for c in [produto_para_salvar.get('condicao')] if c]
            detalhes_extras.extend([f"🏪 Vendedor: {v}" for v in [produto_para_salvar.get('vendedor')] if v])
            detalhes_extras.extend([f"📊 Disponibilidade: {d}" for d in [produto_para_salvar.get('disponivel')] if d])
            
            cupons = produto_para_salvar.get('cupons', [])
            if cupons: detalhes_extras.append(f"🎫 Cupons Disponíveis: {', '.join(cupons)}")
            
            detalhes_texto = "\n".join(detalhes_extras)
            final_link = afiliado_link if afiliado_link else produto_para_salvar.get('link', 'N/A')
            
            descricao_texto = produto_para_salvar.get('descricao', 'Não disponível')
            descricao_curta = f"{descricao_texto[:200]}{'...' if len(descricao_texto) > 200 else ''}"

            mensagem_completa = f"""🛒 **PRODUTO ENCONTRADO NO MERCADO LIVRE**
🔍 **Título:** {produto_para_salvar.get('titulo', 'N/A')}
{promocao_info}
{detalhes_texto}
🔗 **Link:** {final_link}
📄 **Descrição:** {descricao_curta}
⏰ **Analisado em:** {datetime.datetime.now(pytz.timezone('America/Sao_Paulo')).strftime('%d/%m/%Y às %H:%M:%S')}"""

            payload = {
                "command": "tech",
                "message": mensagem_completa.strip(),
                "type": "produto_promocao" if produto_para_salvar.get('tem_promocao') else "produto_normal",
                "produto_dados": produto_para_salvar,
                "timestamp": time.time(),
                "source": "Mercado Livre Scraper"
            }
        else:
            return jsonify({'error': 'Tipo de webhook inválido'}), 400
        
        # CHAMA O SERVIÇO DE WEBHOOK
        response = services.enviar_para_webhook(payload)
        
        # TRATA A RESPOSTA E SALVA NO BANCO DE DADOS
        if response.status_code in [200, 201, 202]:
            try:
                n8n_response_data = response.json()
                final_message = n8n_response_data.get('message', 'Mensagem final não recebida.')
                image_url = n8n_response_data.get('image_url', '')

                if tipo == 'produto':
                    database.salvar_promocao(produto_para_salvar, final_message=final_message)

                return jsonify({'success': True, 'message': 'Webhook enviado.', 'final_message': final_message, 'image_url': image_url, 'webhook_status': response.status_code})
            except requests.exceptions.JSONDecodeError:
                if tipo == 'produto':
                    database.salvar_promocao(produto_para_salvar, final_message=response.text)
                return jsonify({'success': True, 'message': 'Webhook enviado, mas resposta não é JSON.', 'final_message': response.text, 'image_url': '', 'webhook_status': response.status_code})
        else:
            final_message = response.text
            if tipo == 'produto':
                database.salvar_promocao(produto_para_salvar, final_message=final_message)
            return jsonify({'error': f'Webhook retornou status {response.status_code}', 'webhook_response': response.text, 'final_message': final_message, 'image_url': ''}), 400
        
    except requests.exceptions.Timeout:
        if 'produto_para_salvar' in locals() and tipo == 'produto':
            database.salvar_promocao(produto_para_salvar, final_message='Timeout ao enviar webhook')
        return jsonify({'error': 'Timeout ao enviar webhook', 'final_message': 'Timeout'}), 408
    except requests.exceptions.ConnectionError:
        if 'produto_para_salvar' in locals() and tipo == 'produto':
            database.salvar_promocao(produto_para_salvar, final_message='Erro de conexão com o webhook')
        return jsonify({'error': 'Erro de conexão com o webhook', 'final_message': 'Erro de conexão'}), 503
    except Exception as e:
        final_message_erro = f'Erro interno: {str(e)}'
        if 'produto_para_salvar' in locals() and tipo == 'produto':
            database.salvar_promocao(produto_para_salvar, final_message=final_message_erro)
        return jsonify({'error': final_message_erro, 'final_message': final_message_erro}), 500

@main_bp.route('/produtos/<string:produto_id>', methods=['DELETE'])
def deletar_produto(produto_id):
    try:
        response = database.deletar_produto_db(produto_id)
        if response.data:
            return jsonify({'success': True, 'message': 'Produto deletado com sucesso!'}), 200
        else:
            return jsonify({'success': False, 'error': 'Produto não encontrado ou não foi possível deletar.'}), 404
    except Exception as e:
        return jsonify({'success': False, 'error': f'Erro interno: {str(e)}'}), 500

@main_bp.route('/agendar_produto/<string:produto_id>', methods=['POST'])
def agendar_produto(produto_id):
    try:
        data = request.get_json()
        agendamento = data.get('agendamento')
        if not agendamento:
            return jsonify({'error': 'Dados de agendamento são obrigatórios'}), 400
        
        try:
            naive_dt = datetime.datetime.fromisoformat(agendamento)
            timezone_br = pytz.timezone('America/Sao_Paulo')
            agendamento_dt_br = timezone_br.localize(naive_dt)
            agendamento_dt_utc = agendamento_dt_br.astimezone(pytz.utc)
            agendamento_iso = agendamento_dt_utc.isoformat()
        except (ValueError, pytz.UnknownTimeZoneError) as ve:
            return jsonify({'error': f'Formato de data inválido: {ve}. Use YYYY-MM-DDTHH:MM'}), 400

        response = database.agendar_produto_db(produto_id, agendamento_iso)
        if response.data and len(response.data) > 0:
            return jsonify({'success': True, 'message': 'Produto agendado com sucesso!', 'agendamento': agendamento_dt_br.strftime('%Y-%m-%d %H:%M:%S')})
        else:
            return jsonify({'success': False, 'error': f'Produto com ID {produto_id} não encontrado.'}), 404
            
    except Exception as e:
        return jsonify({'error': f'Erro interno: {str(e)}'}), 500

@main_bp.route('/produtos', methods=['GET'])
def listar_produtos():
    try:
        status_filter = request.args.get('status', 'agendado')
        ordem_order = request.args.get('ordem', 'desc')
        
        produtos = database.listar_produtos_db(status_filter, ordem_order)

        # Formatação de datas para exibição no frontend
        for produto in produtos:
            for key in ["agendamento", "created_at"]:
                if produto.get(key) and isinstance(produto[key], str):
                    try:
                        dt_utc = datetime.datetime.fromisoformat(produto[key].replace('Z', '+00:00'))
                        dt_br = dt_utc.astimezone(pytz.timezone('America/Sao_Paulo'))
                        produto[key] = dt_br.strftime('%Y-%m-%d %H:%M:%S')
                    except Exception:
                        pass # Mantém a string original se houver erro
        
        return jsonify({'success': True, 'produtos': produtos})
    except Exception as e:
        return jsonify({'success': False, 'error': f'Erro ao listar produtos do Supabase: {str(e)}'}), 500

@main_bp.route('/produtos/<string:produto_id>', methods=['GET'])
def obter_produto(produto_id):
    try:
        produto = database.obter_produto_db(produto_id)
        if produto:
            return jsonify({'success': True, 'produto': produto})
        else:
            return jsonify({'success': False, 'error': 'Produto não encontrado'}), 404
    except Exception as e:
        return jsonify({'success': False, 'error': f'Erro interno: {str(e)}'}), 500

@main_bp.route('/produtos/<string:produto_id>', methods=['PUT'])
def editar_produto(produto_id):
    try:
        data = request.get_json()
        imagem_url = data.get('imagem_url', '').strip()
        final_message = data.get('final_message', '').strip()
        preco_com_cupom = data.get('preco_com_cupom', '').strip()
        cupom_info = data.get('cupom_info', {})
        
        if not imagem_url and not final_message and not preco_com_cupom:
            return jsonify({'error': 'Pelo menos um campo deve ser fornecido para edição'}), 400
        
        dados_atualizacao = {}
        if imagem_url:
            dados_atualizacao['imagem_url'] = imagem_url
        if final_message:
            dados_atualizacao['final_message'] = final_message
        if preco_com_cupom:
            dados_atualizacao['preco_com_cupom'] = preco_com_cupom
        if cupom_info:
            dados_atualizacao['cupom_info'] = cupom_info
        
        response = database.atualizar_produto_db(produto_id, dados_atualizacao)
        if response.data and len(response.data) > 0:
            message = 'Produto atualizado com sucesso!'
            if preco_com_cupom and cupom_info.get('texto'):
                message += f' Cupom {cupom_info["texto"]} aplicado!'
            return jsonify({'success': True, 'message': message})
        else:
            return jsonify({'success': False, 'error': f'Produto com ID {produto_id} não encontrado.'}), 404
            
    except Exception as e:
        return jsonify({'error': f'Erro interno: {str(e)}'}), 500

@main_bp.route('/enviar_produto_agendado/<string:produto_id>', methods=['POST'])
def enviar_produto_agendado(produto_id):
    try:
        data = request.get_json()
        afiliado_link = data.get('afiliado_link', '').strip()
        
        # Busca o produto no banco de dados (com dados editados)
        produto_db = database.obter_produto_db(produto_id)
        if not produto_db:
            return jsonify({'error': 'Produto não encontrado'}), 404
        
        # Verificar se tem cupom aplicado
        preco_para_usar = produto_db.get('preco_com_cupom') or produto_db.get('preco_atual')
        tem_cupom_aplicado = produto_db.get('preco_com_cupom') is not None
        
        # Monta o produto usando dados do banco (dados editados)
        produto_para_webhook = {
            'titulo': produto_db.get('titulo'),
            'preco_atual': preco_para_usar,  # Usa preço com cupom se disponível
            'preco_original': produto_db.get('preco_original'),
            'desconto': produto_db.get('desconto'),
            'tem_promocao': produto_db.get('preco_original') is not None or tem_cupom_aplicado,
            'imagem': produto_db.get('imagem_url') or produto_db.get('processed_image_url'),  # USA IMAGEM EDITADA
            'link': produto_db.get('link_produto'),
            'descricao': produto_db.get('descricao'),
            'condicao': produto_db.get('condicao'),
            'vendedor': produto_db.get('vendedor'),
            'disponivel': produto_db.get('disponivel'),
            'cupons': produto_db.get('cupons', []),
            'afiliado_link': afiliado_link,
            'cupom_aplicado': produto_db.get('cupom_info')  # Informações do cupom
        }

        # LÓGICA PARA MONTAR O PAYLOAD COM DADOS DO BANCO
        promocao_info = ""
        cupom_info = produto_db.get('cupom_info')
        
        if tem_cupom_aplicado and cupom_info:
            # Se tem cupom aplicado, mostrar informações do cupom
            preco_original_cupom = cupom_info.get('preco_original', produto_db.get('preco_atual', 'N/A'))
            
            # Construir descrição baseada no tipo de cupom
            cupom_tipo = cupom_info.get('tipo', 'porcentagem')
            cupom_valor = cupom_info.get('valor', 0)
            
            if cupom_tipo == 'porcentagem':
                desconto_descricao = f"🔥 Desconto: {cupom_valor}%"
            else:
                desconto_descricao = f"🔥 Desconto: R$ {cupom_valor:.2f}".replace('.', ',')
            
            promocao_info = f"""🎟️ **CUPOM APLICADO: {cupom_info.get('texto', '')}**
💰 Preço Original: {preco_original_cupom}
💸 Preço com Cupom: {produto_para_webhook.get('preco_atual', 'N/A')}
{desconto_descricao}"""
        elif produto_para_webhook.get('tem_promocao'):
            promocao_info = f"""🔥 **PRODUTO EM PROMOÇÃO!**
💰 Preço Original: {produto_para_webhook.get('preco_original', 'N/A')}
💸 Preço Atual: {produto_para_webhook.get('preco_atual', 'N/A')}
🏷️ Desconto: {produto_para_webhook.get('desconto', 'N/A')}"""
        else:
            promocao_info = f"💵 Preço: {produto_para_webhook.get('preco_atual', 'N/A')}"
        
        detalhes_extras = [f"📦 Condição: {c}" for c in [produto_para_webhook.get('condicao')] if c]
        detalhes_extras.extend([f"🏪 Vendedor: {v}" for v in [produto_para_webhook.get('vendedor')] if v])
        detalhes_extras.extend([f"📊 Disponibilidade: {d}" for d in [produto_para_webhook.get('disponivel')] if d])
        
        cupons = produto_para_webhook.get('cupons', [])
        if cupons: detalhes_extras.append(f"🎫 Cupons Disponíveis: {', '.join(cupons)}")
        
        detalhes_texto = "\n".join(detalhes_extras)
        # PRIORIZAR LINK DE AFILIADO: novo link > link original do produto > link do banco
        final_link = afiliado_link if afiliado_link else (produto_db.get('afiliado_link') or produto_para_webhook.get('link', 'N/A'))
        
        # USA A MENSAGEM EDITADA SE EXISTIR, SENÃO USA A PADRÃO
        if produto_db.get('final_message'):
            mensagem_completa = produto_db.get('final_message')
        else:
            descricao_texto = produto_para_webhook.get('descricao', 'Não disponível')
            descricao_curta = f"{descricao_texto[:200]}{'...' if len(descricao_texto) > 200 else ''}"
            
            mensagem_completa = f"""🛒 **PRODUTO ENCONTRADO NO MERCADO LIVRE**
🔍 **Título:** {produto_para_webhook.get('titulo', 'N/A')}
{promocao_info}
{detalhes_texto}
🔗 **Link:** {final_link}
📄 **Descrição:** {descricao_curta}
⏰ **Analisado em:** {datetime.datetime.now(pytz.timezone('America/Sao_Paulo')).strftime('%d/%m/%Y às %H:%M:%S')}"""

        payload = {
            "command": "Mensagem",
            "message": mensagem_completa.strip(),
            "type": "produto_promocao" if produto_para_webhook.get('tem_promocao') else "produto_normal",
            "produto_dados": produto_para_webhook,
            "timestamp": time.time(),
            "source": "Mercado Livre Scraper - Produto Agendado"
        }
        
        # CHAMA O SERVIÇO DE WEBHOOK
        response = services.enviar_para_webhook(payload)
        
        # TRATA A RESPOSTA
        if response.status_code in [200, 201, 202]:
            try:
                n8n_response_data = response.json()
                final_message = n8n_response_data.get('message', 'Mensagem final não recebida.')
                image_url = n8n_response_data.get('image_url', '')
                
                return jsonify({
                    'success': True, 
                    'message': 'Produto enviado com sucesso!', 
                    'final_message': final_message, 
                    'image_url': image_url, 
                    'webhook_status': response.status_code
                })
            except requests.exceptions.JSONDecodeError:
                return jsonify({
                    'success': True, 
                    'message': 'Produto enviado, mas resposta não é JSON.', 
                    'final_message': response.text, 
                    'image_url': '', 
                    'webhook_status': response.status_code
                })
        else:
            return jsonify({
                'error': f'Webhook retornou status {response.status_code}', 
                'webhook_response': response.text, 
                'final_message': response.text, 
                'image_url': ''
            }), 400
        
    except requests.exceptions.Timeout:
        return jsonify({'error': 'Timeout ao enviar webhook', 'final_message': 'Timeout'}), 408
    except requests.exceptions.ConnectionError:
        return jsonify({'error': 'Erro de conexão com o webhook', 'final_message': 'Erro de conexão'}), 503
    except Exception as e:
        return jsonify({'error': f'Erro interno: {str(e)}', 'final_message': f'Erro interno: {str(e)}'}), 500

# ===== ENDPOINTS PARA SUPABASE STORAGE =====

@main_bp.route('/storage/imagens', methods=['GET'])
def listar_imagens():
    """Lista imagens do bucket do Supabase Storage."""
    try:
        bucket_name = request.args.get('bucket', os.getenv('SUPABASE_BUCKET_NAME', 'imagens_melhoradas_tech'))
        pasta = request.args.get('pasta', '')
        limit = int(request.args.get('limit', 50))
        offset = int(request.args.get('offset', 0))
        search_term = request.args.get('search', '')
        
        imagens = database.listar_imagens_bucket(
            bucket_name=bucket_name,
            pasta=pasta,
            limit=limit,
            offset=offset,
            search_term=search_term
        )
        
        return jsonify({
            'success': True,
            'imagens': imagens,
            'total': len(imagens),
            'offset': offset,
            'limit': limit
        })
        
    except Exception as e:
        return jsonify({'success': False, 'error': f'Erro ao listar imagens: {str(e)}'}), 500

@main_bp.route('/storage/pastas', methods=['GET'])
def listar_pastas():
    """Lista pastas do bucket do Supabase Storage."""
    try:
        bucket_name = request.args.get('bucket', os.getenv('SUPABASE_BUCKET_NAME', 'imagens_melhoradas_tech'))
        pasta_pai = request.args.get('pasta_pai', '')
        
        pastas = database.listar_pastas_bucket(
            bucket_name=bucket_name,
            pasta_pai=pasta_pai
        )
        
        return jsonify({
            'success': True,
            'pastas': pastas
        })
        
    except Exception as e:
        return jsonify({'success': False, 'error': f'Erro ao listar pastas: {str(e)}'}), 500

@main_bp.route('/storage/url_publica', methods=['POST'])
def obter_url_publica():
    """Obtém URL pública de uma imagem específica."""
    try:
        data = request.get_json()
        bucket_name = data.get('bucket', os.getenv('SUPABASE_BUCKET_NAME', 'imagens_melhoradas_tech'))
        caminho_arquivo = data.get('caminho', '')
        
        if not caminho_arquivo:
            return jsonify({'success': False, 'error': 'Caminho do arquivo é obrigatório'}), 400
        
        url = database.obter_url_publica_imagem(
            bucket_name=bucket_name,
            caminho_arquivo=caminho_arquivo
        )
        
        if url:
            return jsonify({'success': True, 'url': url})
        else:
            return jsonify({'success': False, 'error': 'Não foi possível obter a URL'}), 404
            
    except Exception as e:
        return jsonify({'success': False, 'error': f'Erro ao obter URL: {str(e)}'}), 500