// /mercado_livre_scraper/app/static/script.js

// Inicializar Supabase Client
let supabaseClient = null;
let supabaseInitialized = false;

// Função para inicializar o Supabase Client
function initializeSupabase() {
  try {
    const supabaseUrl = localStorage.getItem('supabase_url') || 'https://cfacybymuscwcpgmbjkz.supabase.co';
    const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNmYWN5YnltdXNjd2NwZ21iamt6Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NTk1MzY4MSwiZXhwIjoyMDcxNTI5NjgxfQ.6IWnYtV1u0PpUVp72HPbKzel2VTuoLzVEz6IJuuThvs';
    
    if (typeof supabase !== 'undefined') {
      supabaseClient = supabase.createClient(supabaseUrl, supabaseKey);
      supabaseInitialized = true;
      console.log('✅ Supabase Client inicializado com sucesso');
    } else {
      console.warn('⚠️ Supabase JS não foi carregado');
    }
  } catch (error) {
    console.error('❌ Erro ao inicializar Supabase Client:', error);
  }
}

// Função para fazer download direto de imagens via Supabase JS
async function downloadImageDirect(filePath, bucketName = null) {
  if (!supabaseInitialized || !supabaseClient) {
    console.log('📡 Fallback: usando API tradicional para imagem');
    return null;
  }

  try {
    const bucket = bucketName || bucketAtual;
    console.log(`🔄 Baixando imagem via Supabase JS: ${filePath} do bucket ${bucket}`);
    
    const { data, error } = await supabaseClient.storage
      .from(bucket)
      .download(filePath);
    
    if (error) {
      console.error('❌ Erro no download direto:', error.message);
      return null;
    }

    // Criar URL do objeto para exibição
    const url = URL.createObjectURL(data);
    console.log('✅ Imagem baixada via Supabase JS:', filePath);
    return url;
    
  } catch (error) {
    console.error('❌ Erro ao baixar imagem diretamente:', error.message);
    return null;
  }
}

// Função para listar imagens via Supabase JS (alternativa à API)
async function listImagesDirect(bucketName = null, path = '', limit = 20, offset = 0) {
  if (!supabaseInitialized || !supabaseClient) {
    return null;
  }

  try {
    const bucket = bucketName || bucketAtual;
    console.log(`🔍 Listando imagens via Supabase JS do bucket: ${bucket}`);
    
    const { data, error } = await supabaseClient.storage
      .from(bucket)
      .list(path, {
        limit: limit,
        offset: offset,
        sortBy: { column: 'created_at', order: 'desc' }
      });
    
    if (error) {
      console.error('❌ Erro ao listar imagens:', error.message);
      return null;
    }

    // Converter para o formato esperado pela aplicação
    const imagens = data
      .filter(file => file.name && !file.name.endsWith('/'))
      .map(file => {
        const publicUrl = supabaseClient.storage
          .from(bucket)
          .getPublicUrl(path + file.name);
        
        return {
          nome: file.name,
          url: publicUrl.data.publicUrl,
          tamanho: file.metadata?.size || 0,
          caminho: path + file.name
        };
      });

    console.log(`✅ ${imagens.length} imagens listadas via Supabase JS`);
    return imagens;
    
  } catch (error) {
    console.error('❌ Erro ao listar imagens via Supabase JS:', error.message);
    return null;
  }
}

// Funções no escopo global para o HTML poder acessá-las
window.openAgendamentoForm = function (produtoId) {
  document.getElementById("agendarProdutoId").value = produtoId;
  document.getElementById("agendamentoModal").style.display = "block";
};

window.closeModal = function () {
  document.getElementById("agendamentoModal").style.display = "none";
};

window.openEditarForm = function (produtoId) {
  document.getElementById("editarProdutoId").value = produtoId;

  // Limpar os campos
  document.getElementById("editarImagemUrl").value = "";
  document.getElementById("editarMensagem").value = "";
  
  // Limpar campos do cupom
  document.getElementById("cupomTexto").value = "";
  document.getElementById("cupomValor").value = "";
  document.getElementById("cupomLinkAfiliado").value = "";
  document.getElementById("cupomPreview").style.display = "none";
  // Reset tipo para porcentagem
  document.getElementById("cupomTipo").value = "porcentagem";
  alterarTipoCupom();

  // Resetar preview
  updateImagePreview();

  // Buscar dados atuais do produto
  fetch(`/produtos/${produtoId}`, { method: "GET" })
    .then((response) => response.json())
    .then((data) => {
      if (data.success) {
        const produto = data.produto;
        
        // Armazenar dados do produto na variável global
        produtoAtualData = produto;
        
        document.getElementById("editarImagemUrl").value =
          produto.imagem_url || "";
        document.getElementById("editarMensagem").value =
          produto.final_message || "";

        // Atualizar preview da imagem após carregar os dados
        updateImagePreview();
      }
    })
    .catch((error) => {
      console.error("Erro ao carregar dados do produto:", error);
      produtoAtualData = null;
    });

  document.getElementById("editarModal").style.display = "block";
};

window.closeEditModal = function () {
  document.getElementById("editarModal").style.display = "none";
  
  // Limpar dados globais do produto
  produtoAtualData = null;
};

window.enviarProdutoAgendado = async function (produtoId) {
  if (
    !confirm(
      "Deseja enviar este produto para o webhook? Isso irá usar os dados editados (imagem e mensagem personalizadas)."
    )
  ) {
    return;
  }

  const loading = document.getElementById("loading");
  loading.style.display = "block";
  loading.querySelector("p").textContent = "Enviando produto para webhook...";

  try {
    // Você pode solicitar o link afiliado aqui ou usar vazio
    const afiliadoLink = prompt("Cole o link de afiliado (opcional):");

    const response = await fetch(`/enviar_produto_agendado/${produtoId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        afiliado_link: afiliadoLink || "",
      }),
    });

    const data = await response.json();

    if (response.ok) {
      showAlert("Produto enviado com sucesso! ✅", "success");

      // Mostra a resposta do webhook se houver
      if (data.final_message) {
        displayWebhookResponse(data.final_message, data.image_url);
      }
    } else {
      showAlert(`Erro ao enviar: ${data.error}`, "error");
    }
  } catch (error) {
    console.error("Erro ao enviar produto:", error);
    showAlert("Erro de conexão ao enviar produto.", "error");
  } finally {
    loading.style.display = "none";
  }
};

function displayWebhookResponse(message, imageUrl) {
  const webhookMessageSection = document.getElementById(
    "webhookMessageSection"
  );
  const webhookMessageContent = document.getElementById(
    "webhookMessageContent"
  );

  let imageHtml = "";
  if (imageUrl && imageUrl.trim()) {
    imageHtml = `<div class="webhook-image"><img src="${imageUrl}" alt="Imagem do Produto"></div>`;
  }

  const messageHtml = `
    <div class="webhook-message-container success" style="margin-bottom: 20px;">
      <div class="webhook-message-header">
        <h3>✅ Produto Enviado com Sucesso</h3>
        <span class="status success">SUCCESS</span>
      </div>
      ${imageHtml}
      <pre>${message}</pre>
    </div>
  `;

  webhookMessageContent.innerHTML = messageHtml;
  webhookMessageSection.style.display = "block";
  webhookMessageSection.scrollIntoView({ behavior: "smooth" });
}

window.updateImagePreview = function () {
  const imageUrl = document.getElementById("editarImagemUrl").value.trim();
  const imagePreview = document.getElementById("imagePreview");
  const placeholder = document.getElementById("imagePreviewPlaceholder");

  if (imageUrl && isValidImageUrl(imageUrl)) {
    imagePreview.src = imageUrl;
    imagePreview.style.display = "block";
    placeholder.style.display = "none";

    // Adiciona eventos para lidar com erro de carregamento
    imagePreview.onload = function () {
      imagePreview.style.display = "block";
      placeholder.style.display = "none";
    };

    imagePreview.onerror = function () {
      imagePreview.style.display = "none";
      placeholder.style.display = "block";
      placeholder.innerHTML = "❌ Erro ao carregar imagem";
    };
  } else {
    imagePreview.style.display = "none";
    placeholder.style.display = "block";
    if (imageUrl && !isValidImageUrl(imageUrl)) {
      placeholder.innerHTML = "⚠️ URL de imagem inválida";
    } else {
      placeholder.innerHTML = "📷 Nenhuma imagem para mostrar";
    }
  }
};

// Variáveis globais para dados do produto atual
let produtoAtualData = null;

// Função para alterar tipo de cupom
window.alterarTipoCupom = function () {
  const cupomTipo = document.getElementById("cupomTipo").value;
  const cupomValorLabel = document.getElementById("cupomValorLabel");
  const cupomValorInput = document.getElementById("cupomValor");

  if (cupomTipo === "porcentagem") {
    cupomValorLabel.textContent = "Desconto (%)";
    cupomValorInput.placeholder = "10";
    cupomValorInput.max = "99";
    cupomValorInput.step = "1";
  } else {
    cupomValorLabel.textContent = "Desconto (R$)";
    cupomValorInput.placeholder = "60.00";
    cupomValorInput.removeAttribute("max");
    cupomValorInput.step = "0.01";
  }
  
  // Limpar o valor atual quando trocar tipo
  cupomValorInput.value = "";
};

// Função para calcular e mostrar preview do desconto
window.calcularDesconto = function () {
  const cupomTexto = document.getElementById("cupomTexto").value.trim();
  const cupomTipo = document.getElementById("cupomTipo").value;
  const cupomValor = parseFloat(document.getElementById("cupomValor").value);
  const cupomPreview = document.getElementById("cupomPreview");
  const cupomInfo = document.getElementById("cupomInfo");

  if (!cupomTexto || !cupomValor || cupomValor <= 0) {
    cupomPreview.style.display = "none";
    return;
  }

  // Validações específicas por tipo
  if (cupomTipo === "porcentagem" && (cupomValor < 1 || cupomValor > 99)) {
    cupomPreview.style.display = "none";
    return;
  }

  if (produtoAtualData && produtoAtualData.preco_atual) {
    // Extrair valor numérico do preço
    const precoOriginal = extrairValorNumerico(produtoAtualData.preco_atual);
    if (precoOriginal > 0) {
      let desconto, novoPreco, cupomDescricao;
      
      if (cupomTipo === "porcentagem") {
        desconto = (precoOriginal * cupomValor) / 100;
        cupomDescricao = `${cupomTexto} (-${cupomValor}%)`;
      } else {
        desconto = cupomValor;
        cupomDescricao = `${cupomTexto} (-R$ ${cupomValor.toFixed(2).replace('.', ',')})`;
      }
      
      novoPreco = Math.max(0, precoOriginal - desconto); // Não pode ser negativo
      
      cupomInfo.innerHTML = `
        <div style="display: grid; grid-template-columns: auto auto; gap: 12px; align-items: center;">
          <span>💰 Preço Original:</span>
          <span style="font-weight: 500;">R$ ${precoOriginal.toFixed(2).replace('.', ',')}</span>
          
          <span>🎟️ Cupom:</span>
          <span style="font-weight: 500; color: #ff6b6b;">${cupomDescricao}</span>
          
          <span>💸 Desconto:</span>
          <span style="font-weight: 500; color: #28a745;">-R$ ${desconto.toFixed(2).replace('.', ',')}</span>
          
          <span>🏷️ <strong>Preço Final:</strong></span>
          <span style="font-weight: 700; color: #007bff; font-size: 16px;">R$ ${novoPreco.toFixed(2).replace('.', ',')}</span>
        </div>
      `;
      cupomPreview.style.display = "block";
    } else {
      cupomPreview.style.display = "none";
    }
  } else {
    cupomInfo.innerHTML = `
      <div style="color: #666; font-style: italic;">
        ℹ️ Preview será calculado com base no preço do produto
      </div>
    `;
    cupomPreview.style.display = "block";
  }
};

// Função para aplicar cupom à mensagem
window.aplicarCupom = function () {
  const cupomTexto = document.getElementById("cupomTexto").value.trim();
  const cupomTipo = document.getElementById("cupomTipo").value;
  const cupomValor = parseFloat(document.getElementById("cupomValor").value);
  const cupomLinkAfiliado = document.getElementById("cupomLinkAfiliado").value.trim();
  const mensagemTextarea = document.getElementById("editarMensagem");

  if (!cupomTexto || !cupomValor || cupomValor <= 0) {
    showAlert("Por favor, preencha o texto do cupom e um valor válido", "error");
    return;
  }

  // Validações específicas por tipo
  if (cupomTipo === "porcentagem" && (cupomValor < 1 || cupomValor > 99)) {
    showAlert("Porcentagem deve estar entre 1% e 99%", "error");
    return;
  }

  if (!produtoAtualData) {
    showAlert("Erro: dados do produto não encontrados", "error");
    return;
  }

  // Calcular novo preço
  const precoOriginal = extrairValorNumerico(produtoAtualData.preco_atual);
  if (precoOriginal <= 0) {
    showAlert("Erro: não foi possível extrair o preço do produto", "error");
    return;
  }

  let desconto, novoPreco;
  if (cupomTipo === "porcentagem") {
    desconto = (precoOriginal * cupomValor) / 100;
  } else {
    desconto = cupomValor;
  }
  
  novoPreco = Math.max(0, precoOriginal - desconto);
  const novoPrecoFormatado = `R$ ${novoPreco.toFixed(2).replace('.', ',')}`;

  // Construir nova mensagem com cupom (incluindo link de afiliado)
  const mensagemComCupom = construirMensagemComCupom(produtoAtualData, cupomTexto, cupomTipo, cupomValor, precoOriginal, novoPreco, desconto, cupomLinkAfiliado);
  
  // Atualizar textarea
  mensagemTextarea.value = mensagemComCupom;
  
  // Armazenar dados do cupom aplicado para quando salvar
  produtoAtualData.cupom_aplicado = {
    texto: cupomTexto,
    tipo: cupomTipo,
    valor: cupomValor,
    preco_original: produtoAtualData.preco_atual,
    preco_novo: novoPrecoFormatado,
    desconto: desconto,
    link_afiliado: cupomLinkAfiliado
  };
  
  // Limpar campos do cupom
  document.getElementById("cupomTexto").value = "";
  document.getElementById("cupomValor").value = "";
  document.getElementById("cupomLinkAfiliado").value = "";
  document.getElementById("cupomPreview").style.display = "none";
  // Reset tipo para porcentagem
  document.getElementById("cupomTipo").value = "porcentagem";
  alterarTipoCupom();

  const tipoDescricao = cupomTipo === "porcentagem" ? `${cupomValor}%` : `R$ ${cupomValor.toFixed(2).replace('.', ',')}`;
  showAlert(`🎉 Cupom ${cupomTexto} (${tipoDescricao}) aplicado! Preço atualizado para ${novoPrecoFormatado}. Salve as alterações para confirmar.`, "success");
};

// Função auxiliar para extrair valor numérico do preço
function extrairValorNumerico(precoTexto) {
  if (!precoTexto) return 0;
  
  // Remove "R$", espaços e outros caracteres não numéricos, exceto vírgulas e pontos
  const numeroLimpo = precoTexto.toString()
    .replace(/R\$/g, '')
    .replace(/\s/g, '')
    .replace(/[^\d,.]/g, ''); // Remove tudo exceto dígitos, vírgula e ponto
  
  // Se tem ponto seguido de vírgula (ex: 1.234,56), trata como milhares e centavos
  if (numeroLimpo.includes('.') && numeroLimpo.includes(',')) {
    const valor = parseFloat(numeroLimpo.replace(/\./g, '').replace(',', '.'));
    return isNaN(valor) ? 0 : valor;
  }
  
  // Se tem apenas vírgula, substitui por ponto para decimal
  if (numeroLimpo.includes(',') && !numeroLimpo.includes('.')) {
    const valor = parseFloat(numeroLimpo.replace(',', '.'));
    return isNaN(valor) ? 0 : valor;
  }
  
  // Se tem apenas ponto, verifica se é decimal ou milhares
  if (numeroLimpo.includes('.')) {
    const partes = numeroLimpo.split('.');
    if (partes.length === 2 && partes[1].length <= 2) {
      // É decimal (ex: 123.45)
      const valor = parseFloat(numeroLimpo);
      return isNaN(valor) ? 0 : valor;
    } else {
      // É milhares (ex: 1.234)
      const valor = parseFloat(numeroLimpo.replace(/\./g, ''));
      return isNaN(valor) ? 0 : valor;
    }
  }
  
  // Se não tem ponto nem vírgula, é um número inteiro
  const valor = parseFloat(numeroLimpo);
  return isNaN(valor) ? 0 : valor;
}

// Função para construir mensagem com cupom
function construirMensagemComCupom(produto, cupomTexto, cupomTipo, cupomValor, precoOriginal, novoPreco, desconto, linkAfiliado) {
  // PRIORIZAR LINK DE AFILIADO FORNECIDO PELO USUÁRIO
  const linkProduto = linkAfiliado || produto.afiliado_link || produto.link_produto || produto.link || 'Link não disponível';
  
  // Construir descrição do desconto baseado no tipo
  let descontoDescricao;
  if (cupomTipo === "porcentagem") {
    descontoDescricao = `🔥 *${cupomValor}% DE DESCONTO*`;
  } else {
    descontoDescricao = `🔥 *R$ ${cupomValor.toFixed(2).replace('.', ',')} DE DESCONTO*`;
  }
  
  return `🛒 *${produto.titulo}*

💰 ~~R$ ${precoOriginal.toFixed(2).replace('.', ',')}~~

🎟️ *CUPOM: ${cupomTexto}*
${descontoDescricao}

💸 *PREÇO COM CUPOM: R$ ${novoPreco.toFixed(2).replace('.', ',')}*

✨ Economize R$ ${desconto.toFixed(2).replace('.', ',')}!

🛒 Link: ${linkProduto}

⚡ Oferta por tempo limitado!
🎯 Use o cupom: *${cupomTexto}*`;
}

function isValidImageUrl(url) {
  try {
    new URL(url);
    // Verifica se tem extensão de imagem comum ou se é de um domínio conhecido de imagens
    const imageExtensions = /\.(jpg|jpeg|png|gif|webp|svg|bmp)(\?.*)?$/i;
    const knownImageDomains = /(mlstatic\.com|imgur\.com|cloudinary\.com)/i;
    return (
      imageExtensions.test(url) ||
      knownImageDomains.test(url) ||
      url.includes("http")
    );
  } catch {
    return false;
  }
}

// ===== INÍCIO DA ALTERAÇÃO =====
window.deletarAgendamento = async function (produtoId, buttonElement) {
  if (!confirm("Tem certeza que deseja excluir este produto?")) {
    return;
  }

  // 1. Encontra o card do produto mais próximo do botão que foi clicado.
  const cardParaRemover = buttonElement.closest(".product-card");

  // 2. Remove o card da tela IMEDIATAMENTE para o efeito instantâneo.
  if (cardParaRemover) {
    cardParaRemover.style.transition = "opacity 0.3s ease-out";
    cardParaRemover.style.opacity = "0";
    setTimeout(() => cardParaRemover.remove(), 300); // Remove do DOM após a transição
  }

  try {
    const response = await fetch(`/produtos/${produtoId}`, {
      method: "DELETE",
    });

    const data = await response.json();

    // 3. Apenas mostra a notificação. Não recarrega mais a lista inteira.
    if (response.ok) {
      showAlert(data.message, "success");
      // Não precisamos mais chamar loadAgendamentos() aqui!
    } else {
      // 4. Se a exclusão falhar no servidor, mostra o erro e recarrega a lista
      // para que o item reapareça, mantendo a consistência.
      showAlert(data.error || "Erro ao excluir o produto.", "error");
      loadAgendamentos();
    }
  } catch (error) {
    // 5. Se houver um erro de conexão, faz a mesma coisa.
    showAlert("Erro de conexão ao tentar excluir o produto.", "error");
    loadAgendamentos();
  }
};
// ===== FIM DA ALTERAÇÃO =====

document.addEventListener("DOMContentLoaded", function () {
  // Inicializar Supabase Client
  console.log('🚀 Inicializando Supabase Client...');
  initializeSupabase();
  
  // Configuração do modo escuro
  const themeToggle = document.getElementById("themeToggle");
  const savedTheme = localStorage.getItem("theme") || "light";
  
  // Aplicar tema salvo
  if (savedTheme === "dark") {
    document.documentElement.setAttribute("data-theme", "dark");
    themeToggle.textContent = "☀️";
  } else {
    themeToggle.textContent = "🌙";
  }
  
  // Toggle do modo escuro
  themeToggle.addEventListener("click", function() {
    const currentTheme = document.documentElement.getAttribute("data-theme");
    const newTheme = currentTheme === "dark" ? "light" : "dark";
    
    document.documentElement.setAttribute("data-theme", newTheme);
    localStorage.setItem("theme", newTheme);
    
    // Atualizar ícone
    themeToggle.textContent = newTheme === "dark" ? "☀️" : "🌙";
    
    // Notificação
    showAlert(
      `Modo ${newTheme === "dark" ? "escuro" : "claro"} ativado!`,
      "info"
    );
  });

  const searchForm = document.getElementById("searchForm");
  const linkForm = document.getElementById("linkForm");
  const webhookForm = document.getElementById("webhookForm");
  const loading = document.getElementById("loading");
  const resultsSection = document.getElementById("resultsSection");
  const produtoSection = document.getElementById("produtoSection");
  const productsGrid = document.getElementById("productsGrid");
  const produtoDetalhado = document.getElementById("produtoDetalhado");
  const resultsCount = document.getElementById("resultsCount");
  const clearBtn = document.getElementById("clearBtn");
  const clearProdutoBtn = document.getElementById("clearProdutoBtn");
  const webhookMessageSection = document.getElementById(
    "webhookMessageSection"
  );
  const webhookMessageContent = document.getElementById(
    "webhookMessageContent"
  );
  const clearWebhookBtn = document.getElementById("clearWebhookBtn");
  const searchBtn = document.getElementById("searchBtn");
  const linkBtn = document.getElementById("linkBtn");
  const webhookBtn = document.getElementById("webhookBtn");

  // Variáveis da nova interface de webhook
  let productQueue = [];
  
  // Elementos da nova interface
  const inputMethods = document.querySelectorAll('.input-method');
  const inputContents = document.querySelectorAll('.input-content');
  const addProductBtn = document.getElementById('addProductBtn');
  const productUrlInput = document.getElementById('productUrl');
  const affiliateUrlInput = document.getElementById('affiliateUrl');
  const queueList = document.getElementById('queueList');
  const queueCount = document.querySelector('.queue-count');
  const processCount = document.getElementById('processCount');
  const clearQueueBtn = document.getElementById('clearQueueBtn');
  const importFromBulkBtn = document.getElementById('importFromBulkBtn');

  const clearWebhookTextareaBtn = document.getElementById(
    "clearWebhookTextareaBtn"
  );
  const webhookUrlsTextarea = document.getElementById("webhookUrls");

  clearWebhookTextareaBtn.addEventListener("click", function () {
    webhookUrlsTextarea.value = ""; // Limpa o conteúdo
    webhookUrlsTextarea.focus(); // Opcional: foca no campo após limpar
  });

  // === NOVA INTERFACE DE WEBHOOK ===
  
  // Alternar entre modos (Visual/Massa)
  inputMethods.forEach(method => {
    method.addEventListener('click', () => {
      const methodType = method.dataset.method;
      
      // Remove active de todos
      inputMethods.forEach(m => m.classList.remove('active'));
      inputContents.forEach(c => c.classList.remove('active'));
      
      // Ativa o selecionado
      method.classList.add('active');
      document.querySelector(`.${methodType}-mode`).classList.add('active');
    });
  });

  // Adicionar produto à fila
  addProductBtn.addEventListener('click', () => {
    const productUrl = productUrlInput.value.trim();
    const affiliateUrl = affiliateUrlInput.value.trim();

    if (!productUrl) {
      showAlert('Por favor, insira um link de produto', 'error');
      return;
    }

    if (!productUrl.includes('mercadolivre.com') && !productUrl.includes('mercadolibre.com')) {
      showAlert('Por favor, use um link válido do Mercado Livre', 'error');
      return;
    }

    // Verificar se já existe na fila
    const exists = productQueue.some(item => item.productUrl === productUrl);
    if (exists) {
      showAlert('Este produto já está na fila', 'warning');
      return;
    }

    // Adicionar à fila
    const queueItem = {
      id: Date.now(),
      productUrl: productUrl,
      affiliateUrl: affiliateUrl || '',
      addedAt: new Date().toLocaleTimeString()
    };

    productQueue.push(queueItem);
    updateQueueDisplay();
    
    // Limpar campos
    productUrlInput.value = '';
    affiliateUrlInput.value = '';
    productUrlInput.focus();

    showAlert('Produto adicionado à fila!', 'success');
  });

  // Importar do modo em massa
  importFromBulkBtn.addEventListener('click', () => {
    const urlsText = webhookUrlsTextarea.value.trim();
    const lines = urlsText.split('\n').filter(line => line.trim() !== '');

    if (lines.length === 0) {
      showAlert('Nenhum link encontrado para importar', 'error');
      return;
    }

    let imported = 0;
    lines.forEach(line => {
      const parts = line.split(',');
      const productUrl = parts[0] ? parts[0].trim() : '';
      const affiliateUrl = parts[1] ? parts[1].trim() : '';

      if (productUrl && (productUrl.includes('mercadolivre.com') || productUrl.includes('mercadolibre.com'))) {
        // Verificar se já existe
        const exists = productQueue.some(item => item.productUrl === productUrl);
        if (!exists) {
          const queueItem = {
            id: Date.now() + imported,
            productUrl: productUrl,
            affiliateUrl: affiliateUrl,
            addedAt: new Date().toLocaleTimeString()
          };
          productQueue.push(queueItem);
          imported++;
        }
      }
    });

    updateQueueDisplay();
    
    if (imported > 0) {
      showAlert(`${imported} produtos importados para a fila!`, 'success');
      // Mudar para modo visual
      document.querySelector('[data-method="visual"]').click();
    } else {
      showAlert('Nenhum produto válido foi importado', 'warning');
    }
  });

  // Limpar fila
  clearQueueBtn.addEventListener('click', () => {
    if (productQueue.length === 0) return;
    
    if (confirm('Deseja limpar toda a fila de produtos?')) {
      productQueue = [];
      updateQueueDisplay();
      showAlert('Fila limpa!', 'info');
    }
  });

  // Atualizar display da fila
  function updateQueueDisplay() {
    queueCount.textContent = `(${productQueue.length})`;
    processCount.textContent = productQueue.length;

    if (productQueue.length === 0) {
      queueList.innerHTML = `
        <div class="queue-empty">
          <span class="empty-icon">📦</span>
          <p>Nenhum produto na fila</p>
          <small>Adicione produtos usando o formulário acima</small>
        </div>
      `;
      return;
    }

    queueList.innerHTML = productQueue.map(item => `
      <div class="queue-item" data-id="${item.id}">
        <div class="queue-item-icon">🛒</div>
        <div class="queue-item-content">
          <div class="queue-item-title">
            ${item.productUrl.length > 60 ? item.productUrl.substring(0, 60) + '...' : item.productUrl}
          </div>
          <div class="queue-item-subtitle">
            ${item.affiliateUrl ? `Afiliado: ${item.affiliateUrl.length > 40 ? item.affiliateUrl.substring(0, 40) + '...' : item.affiliateUrl}` : 'Sem link de afiliado'} • ${item.addedAt}
          </div>
        </div>
        <div class="queue-item-actions">
          <button class="remove-item-btn" onclick="removeFromQueue(${item.id})">
            🗑️ Remover
          </button>
        </div>
      </div>
    `).join('');
  }

  // Remover item da fila
  window.removeFromQueue = function(id) {
    productQueue = productQueue.filter(item => item.id !== id);
    updateQueueDisplay();
    showAlert('Produto removido da fila', 'info');
  };

  // Inicializar display
  updateQueueDisplay();

  const filtroAgendamentoForm = document.getElementById(
    "filtroAgendamentoForm"
  );
  const aplicarFiltroBtn = document.getElementById("aplicarFiltroBtn");

  window.showTab = function (tabName, element) {
    document.querySelectorAll(".tab-content").forEach((tab) => {
      tab.classList.remove("active");
    });
    document.querySelectorAll(".tab-btn").forEach((btn) => {
      btn.classList.remove("active");
    });

    document.getElementById("tab-" + tabName).classList.add("active");
    element.classList.add("active");

    // Esconder todas as seções incluindo loading
    resultsSection.style.display = "none";
    produtoSection.style.display = "none";
    webhookMessageSection.style.display = "none";
    loading.style.display = "none";

    if (tabName === "agendamento") {
      loadAgendamentos();
    }
  };

  searchForm.addEventListener("submit", async function (e) {
    e.preventDefault();

    const produto = document.getElementById("produto").value.trim();
    const maxPages = parseInt(document.getElementById("maxPages").value);

    if (!produto) {
      showAlert("Por favor, digite um produto para buscar", "error");
      return;
    }

    loading.style.display = "block";
    loading.querySelector("p").textContent =
      "Buscando produtos no Mercado Livre...";
    resultsSection.style.display = "none";
    produtoSection.style.display = "none";
    webhookMessageSection.style.display = "none";
    searchBtn.disabled = true;

    try {
      const response = await fetch("/buscar", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          produto: produto,
          max_pages: maxPages,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Erro HTTP: ${response.status} - ${errorText}`);
      }

      const data = await response.json();

      if (data.success) {
        displayResults(data.resultados, data.total);
      } else {
        showAlert(data.error || "Erro desconhecido", "error");
      }
    } catch (error) {
      console.error("Erro detalhado:", error);
      showAlert("Erro de conexão: " + error.message, "error");
    } finally {
      loading.style.display = "none";
      searchBtn.disabled = false;
    }
  });

  linkForm.addEventListener("submit", async function (e) {
    e.preventDefault();

    const url = document.getElementById("produtoUrl").value.trim();

    if (!url) {
      showAlert("Por favor, cole o link do produto", "error");
      return;
    }

    if (
      !url.includes("mercadolivre.com") &&
      !url.includes("mercadolibre.com")
    ) {
      showAlert("Por favor, use um link válido do Mercado Livre", "error");
      return;
    }

    loading.style.display = "block";
    loading.querySelector("p").textContent = "Analisando o produto...";
    resultsSection.style.display = "none";
    produtoSection.style.display = "none";
    webhookMessageSection.style.display = "none";
    linkBtn.disabled = true;

    try {
      const response = await fetch("/produto", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          url: url,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Erro HTTP: ${response.status} - ${errorText}`);
      }

      const data = await response.json();

      if (data.success) {
        displayProdutoDetalhado(data.produto);
      } else {
        showAlert(data.error || "Erro desconhecido", "error");
      }
    } catch (error) {
      console.error("Erro detalhado:", error);
      showAlert("Erro de conexão: " + error.message, "error");
    } finally {
      loading.style.display = "none";
      linkBtn.disabled = false;
    }
  });

  webhookForm.addEventListener("submit", async function (e) {
    e.preventDefault();

    // Usar fila de produtos ou textarea como fallback
    let itemsToProcess = [];
    
    if (productQueue.length > 0) {
      itemsToProcess = productQueue.map(item => ({
        productUrl: item.productUrl,
        affiliateLink: item.affiliateUrl
      }));
    } else {
      // Fallback para o modo massa
      const urlsText = document.getElementById("webhookUrls").value.trim();
      const lines = urlsText.split("\n").filter((line) => line.trim() !== "");

      if (lines.length === 0) {
        showAlert("Por favor, adicione produtos à fila ou cole links no modo massa", "error");
        return;
      }

      itemsToProcess = lines.map(line => {
        const parts = line.split(",");
        return {
          productUrl: parts[0] ? parts[0].trim() : "",
          affiliateLink: parts[1] ? parts[1].trim() : ""
        };
      });
    }

    loading.style.display = "block";
    webhookMessageSection.style.display = "none";
    webhookBtn.disabled = true;

    webhookMessageContent.innerHTML = "";
    webhookMessageSection.style.display = "block";

    for (let i = 0; i < itemsToProcess.length; i++) {
      const { productUrl, affiliateLink } = itemsToProcess[i];

      loading.querySelector("p").textContent = `Processando ${i + 1} de ${
        itemsToProcess.length
      }: ${productUrl.substring(0, 50)}...`;

      if (
        !productUrl.includes("mercadolivre.com") &&
        !productUrl.includes("mercadolibre.com")
      ) {
        displayWebhookMessage(
          `Item ${i + 1}: Link de produto inválido.`,
          "error",
          null,
          true
        );
        continue;
      }

      try {
        const produtoResponse = await fetch("/produto", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url: productUrl }),
        });

        if (!produtoResponse.ok)
          throw new Error(`Falha ao buscar dados do produto`);

        const produtoData = await produtoResponse.json();
        const produto = produtoData.produto;

        if (!produto) throw new Error(`Não foi possível extrair dados`);

        const payload = {
          type: "produto",
          produto: produto,
          afiliado_link: affiliateLink,
        };

        const finalResponse = await fetch("/webhook", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

        const finalResult = await finalResponse.json();

        if (finalResponse.ok) {
          displayWebhookMessage(
            finalResult.final_message || "Sucesso!",
            "success",
            finalResult.image_url || produto.imagem,
            true
          );
        } else {
          displayWebhookMessage(
            finalResult.error || "Erro no webhook",
            "error",
            finalResult.image_url || produto.imagem,
            true
          );
        }
      } catch (error) {
        console.error("Erro no processo do webhook:", error);
        displayWebhookMessage(
          `Erro ao processar ${productUrl}: ${error.message}`,
          "error",
          null,
          true
        );
      }
    }

    // Limpar fila após processamento bem-sucedido
    if (productQueue.length > 0) {
      const processedCount = productQueue.length;
      productQueue = [];
      updateQueueDisplay();
      showAlert(`✅ ${processedCount} produto${processedCount > 1 ? 's processados' : ' processado'} com sucesso!`, "success");
    }

    loading.querySelector("p").textContent = "Processamento finalizado!";
    webhookBtn.disabled = false;
    
    // Esconder loading automaticamente após 2 segundos
    setTimeout(() => {
      loading.style.display = "none";
    }, 2000);
  });

  async function loadAgendamentos() {
    const agendamentoList = document.getElementById("agendamento-list");
    agendamentoList.innerHTML = "<p>Carregando produtos...</p>";

    const status = document.getElementById("filtroStatus").value;
    const ordem = document.getElementById("filtroOrdem").value;

    let url = `/produtos?status=${status}&ordem=${ordem}&_t=${Date.now()}`;
    if (status === "todos") {
      url = `/produtos?status=todos&ordem=${ordem}&_t=${Date.now()}`;
    }

    try {
      const response = await fetch(url, { method: "GET" });
      const data = await response.json();

      if (data.success && data.produtos.length > 0) {
        agendamentoList.innerHTML = "";
        data.produtos.forEach((produto) => {
          const card = createAgendamentoCard(produto, status);
          agendamentoList.appendChild(card);
        });
      } else {
        agendamentoList.innerHTML =
          "<p>Nenhum produto encontrado com os filtros selecionados.</p>";
      }
    } catch (error) {
      console.error("Erro ao carregar agendamentos:", error);
      agendamentoList.innerHTML =
        "<p>Erro ao carregar a lista de produtos. Verifique o console.</p>";
    }
  }

  // Auto-aplicar filtros quando alterados
  document
    .getElementById("filtroStatus")
    .addEventListener("change", loadAgendamentos);
  document
    .getElementById("filtroOrdem")
    .addEventListener("change", loadAgendamentos);

  // ===== INÍCIO DA ALTERAÇÃO =====
  function createAgendamentoCard(produto, status) {
    const card = document.createElement("div");
    card.className = "product-card";

    let dataInfo = "";
    let acoesBtn = "";

    if (produto.agendamento) {
      dataInfo = `Agendado para: <b>${produto.agendamento}</b>`;
      acoesBtn = `
          <div class="agendamento-acoes">
              <button class="btn" onclick="openAgendamentoForm('${produto.id}')">Reagendar</button>
              <button class="btn" onclick="openEditarForm('${produto.id}')" style="background-color: #28a745;">Editar</button>
              <button class="btn-excluir" onclick="deletarAgendamento('${produto.id}', this)">Excluir</button>
          </div>
      `;
    } else {
      dataInfo = `Criado em: <b>${produto.created_at || "N/A"}</b>`;
      acoesBtn = `
          <div class="agendamento-acoes">
              <button class="btn" onclick="openAgendamentoForm('${produto.id}')">Agendar</button>
              <button class="btn" onclick="openEditarForm('${produto.id}')" style="background-color: #28a745;">Editar</button>
              <button class="btn-excluir" onclick="deletarAgendamento('${produto.id}', this)">Excluir</button>
          </div>
      `;
    }

    // Prioriza imagem_url se foi editada recentemente, senão usa processed_image_url como fallback
    const imagemParaUsar =
      produto.imagem_url || produto.processed_image_url || "";
    const imagemComCache = imagemParaUsar
      ? `${imagemParaUsar}?t=${Date.now()}`
      : "";

    // Verificar se tem cupom aplicado para mostrar preços diferentes
    let precoHtml = `<div class="product-price-atual">${produto.preco_atual}</div>`;
    
    if (produto.preco_com_cupom && produto.cupom_info) {
      // Construir descrição do cupom baseado no tipo
      let cupomDescricao;
      if (produto.cupom_info.tipo === "porcentagem") {
        cupomDescricao = `🎟️ ${produto.cupom_info.texto} (-${produto.cupom_info.valor}%)`;
      } else {
        cupomDescricao = `🎟️ ${produto.cupom_info.texto} (-R$ ${produto.cupom_info.valor.toFixed(2).replace('.', ',')})`;
      }
      
      precoHtml = `
        <div class="product-price-original" style="text-decoration: line-through; color: #999; font-size: 0.9rem;">
          ${produto.cupom_info.preco_original || produto.preco_atual}
        </div>
        <div class="product-price-atual" style="color: #e74c3c; font-weight: bold;">
          ${produto.preco_com_cupom}
        </div>
        <div class="product-cupom">
          ${cupomDescricao}
        </div>
      `;
    }

    card.innerHTML = `
        <div class="product-header">
          <img src="${imagemComCache}" alt="${produto.titulo}" class="product-image">
          <div class="product-info">
            <div class="product-title">${produto.titulo}</div>
            ${precoHtml}
          </div>
        </div>
        <p>${dataInfo}</p>
        ${acoesBtn}
      `;
    return card;
  }
  // ===== FIM DA ALTERAÇÃO =====

  document
    .getElementById("agendamentoForm")
    .addEventListener("submit", async function (e) {
      e.preventDefault();
      const produtoId = document.getElementById("agendarProdutoId").value;
      const agendarData = document.getElementById("agendarData").value;
      const agendarHora = document.getElementById("agendarHora").value;

      if (!agendarData || !agendarHora) {
        showAlert("Por favor, preencha a data e a hora.", "error");
        return;
      }

      const agendamentoCompleto = `${agendarData}T${agendarHora}:00`;

      loading.style.display = "block";
      loading.querySelector("p").textContent = "Salvando agendamento...";
      closeModal();

      try {
        const response = await fetch(`/agendar_produto/${produtoId}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ agendamento: agendamentoCompleto }),
        });

        const data = await response.json();
        if (response.ok) {
          showAlert(data.message, "success");
          loadAgendamentos();
        } else {
          showAlert(data.error, "error");
        }
      } catch (error) {
        showAlert("Erro ao agendar o produto. Verifique o console.", "error");
      } finally {
        loading.style.display = "none";
      }
    });

  document
    .getElementById("editarForm")
    .addEventListener("submit", async function (e) {
      e.preventDefault();
      const produtoId = document.getElementById("editarProdutoId").value;
      const imagemUrl = document.getElementById("editarImagemUrl").value.trim();
      const mensagem = document.getElementById("editarMensagem").value.trim();

      if (!imagemUrl && !mensagem) {
        showAlert(
          "Por favor, preencha pelo menos um campo para edição.",
          "error"
        );
        return;
      }

      loading.style.display = "block";
      loading.querySelector("p").textContent = "Salvando alterações...";
      closeEditModal();

      try {
        const dadosEdicao = {};
        if (imagemUrl) dadosEdicao.imagem_url = imagemUrl;
        if (mensagem) dadosEdicao.final_message = mensagem;
        
        // Se tem cupom aplicado, enviar também o novo preço
        if (produtoAtualData && produtoAtualData.cupom_aplicado) {
          dadosEdicao.preco_com_cupom = produtoAtualData.cupom_aplicado.preco_novo;
          dadosEdicao.cupom_info = {
            texto: produtoAtualData.cupom_aplicado.texto,
            porcentagem: produtoAtualData.cupom_aplicado.porcentagem,
            preco_original: produtoAtualData.cupom_aplicado.preco_original
          };
        }

        const response = await fetch(`/produtos/${produtoId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(dadosEdicao),
        });

        const data = await response.json();
        if (response.ok) {
          let mensagemSucesso = data.message;
          if (produtoAtualData && produtoAtualData.cupom_aplicado) {
            mensagemSucesso += ` Cupom ${produtoAtualData.cupom_aplicado.texto} aplicado!`;
          }
          showAlert(mensagemSucesso, "success");
          
          // Força a recarga da lista com um pequeno delay para garantir que o servidor processou
          setTimeout(() => {
            loadAgendamentos();
          }, 500);
        } else {
          showAlert(data.error || "Erro ao editar produto", "error");
        }
      } catch (error) {
        showAlert("Erro ao editar o produto. Verifique o console.", "error");
      } finally {
        loading.style.display = "none";
      }
    });

  window.onclick = function (event) {
    const agendamentoModal = document.getElementById("agendamentoModal");
    const editarModal = document.getElementById("editarModal");

    if (event.target == agendamentoModal) {
      closeModal();
    } else if (event.target == editarModal) {
      closeEditModal();
    }
  };

  clearBtn.addEventListener("click", function () {
    resultsSection.style.display = "none";
    productsGrid.innerHTML = "";
  });

  clearProdutoBtn.addEventListener("click", function () {
    produtoSection.style.display = "none";
    produtoDetalhado.innerHTML = "";
  });

  clearWebhookBtn.addEventListener("click", function () {
    webhookMessageSection.style.display = "none";
    webhookMessageContent.innerHTML = "";
  });

  function displayResults(produtos, total) {
    if (total === 0) {
      showAlert("Nenhum produto encontrado para sua busca", "info");
      return;
    }

    resultsCount.textContent = `${total} produtos encontrados`;
    productsGrid.innerHTML = "";

    produtos.forEach((produto) => {
      const card = createProductCard(produto);
      productsGrid.appendChild(card);
    });

    resultsSection.style.display = "block";
    resultsSection.scrollIntoView({ behavior: "smooth" });
  }

  function displayProdutoDetalhado(produto) {
    produtoDetalhado.innerHTML = createProdutoDetalhado(produto);
    produtoSection.style.display = "block";
    produtoSection.scrollIntoView({ behavior: "smooth" });
  }

  function createProductCard(produto) {
    const card = document.createElement("div");
    card.className = "product-card";

    if (produto.tem_promocao) {
      card.classList.add("promocao");
    }

    let imagemHtml = "";
    const imageUrl = produto.imagem || "";
    if (imageUrl.trim()) {
      imagemHtml = `<img src="${imageUrl}" alt="${produto.titulo}" class="product-image">`;
    } else {
      imagemHtml = `<div class="product-image placeholder">📷</div>`;
    }

    let precoHtml = "";
    if (produto.tem_promocao && produto.preco_original) {
      precoHtml = `
        <div class="product-price com-promocao">
          <div class="product-price-original">${produto.preco_original}</div>
          <div class="product-price-atual">${produto.preco_atual}</div>
          ${
            produto.desconto
              ? `<span class="product-desconto">${produto.desconto}</span>`
              : ""
          }
        </div>
      `;
    } else {
      precoHtml = `
        <div class="product-price">
          <div class="product-price-atual">${produto.preco_atual}</div>
        </div>
      `;
    }

    card.innerHTML = `
      ${imagemHtml}
      <div class="product-title">${produto.titulo}</div>
      ${precoHtml}
      <a href="${produto.link}" target="_blank" rel="noopener noreferrer" class="product-link">
        Ver Produto
      </a>
    `;

    return card;
  }

  function createProdutoDetalhado(produto) {
    let precoHtml = "";
    if (produto.tem_promocao && produto.preco_original) {
      precoHtml = `
        <div class="produto-preco com-promocao">
          <div class="produto-preco-original">${produto.preco_original}</div>
          <div class="produto-preco-atual">${produto.preco_atual}</div>
          ${
            produto.desconto
              ? `<div class="produto-desconto">🔥 ${produto.desconto} OFF</div>`
              : ""
          }
        </div>
      `;
    } else {
      precoHtml = `
        <div class="produto-preco">
          <div class="produto-preco-atual">${produto.preco_atual}</div>
        </div>
      `;
    }

    let imagemHtml = "";
    if (produto.imagem && produto.imagem.trim()) {
      imagemHtml = `
        <div class="produto-imagem">
          <img src="${produto.imagem}" alt="${produto.titulo}">
        </div>
      `;
    } else {
      imagemHtml = `
        <div class="produto-imagem">
          <div class="image-placeholder">📷</div>
        </div>
      `;
    }

    return `
      <div class="produto-detalhado ${produto.tem_promocao ? "promocao" : ""}">
        <div class="produto-header">
          ${imagemHtml}
          <div class="produto-info">
            <h2 class="produto-titulo">${produto.titulo}</h2>
            ${precoHtml}
            
            <div class="produto-detalhes">
              ${
                produto.condicao
                  ? `
                <div class="detalhe-item ${
                  produto.tem_promocao ? "promocao" : ""
                }">
                  <div class="detalhe-label">Condição</div>
                  <div class="detalhe-valor">${produto.condicao}</div>
                </div>
              `
                  : ""
              }
              ${
                produto.vendedor
                  ? `
                <div class="detalhe-item ${
                  produto.tem_promocao ? "promocao" : ""
                }">
                  <div class="detalhe-label">Vendedor</div>
                  <div class="detalhe-valor">${produto.vendedor}</div>
                </div>
              `
                  : ""
              }
              ${
                produto.disponivel
                  ? `
                <div class="detalhe-item ${
                  produto.tem_promocao ? "promocao" : ""
                }">
                  <div class="detalhe-label">Disponibilidade</div>
                  <div class="detalhe-valor">${produto.disponivel}</div>
                </div>
              `
                  : ""
              }
              ${
                produto.tem_promocao
                  ? `
                <div class="detalhe-item promocao">
                  <div class="detalhe-label">💰 Promoção Ativa</div>
                  <div class="detalhe-valor">Sim! Aproveite agora</div>
                </div>
              `
                  : ""
              }
            </div>
            
            <a href="${
              produto.link
            }" target="_blank" rel="noopener noreferrer" class="produto-link-externo">
              🛒 Ver no Mercado Livre
            </a>
          </div>
        </div>
        
        ${
          produto.descricao
            ? `
          <div class="produto-descricao">
            <h4>🔍 Descrição</h4>
            <p>${produto.descricao}</p>
          </div>
        `
            : ""
        }
      </div>
    `;
  }

  function displayWebhookMessage(message, type, imageUrl, append = false) {
    const container = document.getElementById("webhookMessageContent");
    if (!append) {
      container.innerHTML = "";
    }
    webhookMessageSection.style.display = "block";

    let imageHtml = "";
    if (imageUrl && imageUrl.trim()) {
      imageHtml = `<div class="webhook-image"><img src="${imageUrl}" alt="Imagem do Produto"></div>`;
    }

    const messageHtml = `
          <div class="webhook-message-container ${type}" style="margin-bottom: 20px;">
            <div class="webhook-message-header">
              <h3>Status:</h3>
              <span class="status ${type}">${type.toUpperCase()}</span>
            </div>
            ${imageHtml}
            <pre>${message}</pre>
          </div>
      `;
    container.innerHTML += messageHtml;

    if (!append) {
      webhookMessageSection.scrollIntoView({ behavior: "smooth" });
    }
  }

  async function copyToClipboard(elementId) {
    const element = document.getElementById(elementId);
    if (element) {
      try {
        await navigator.clipboard.writeText(element.textContent);
        showAlert("Mensagem copiada para a área de transferência!", "info");
      } catch (err) {
        console.error("Erro ao copiar a mensagem: ", err);
        showAlert("Erro ao copiar a mensagem.", "error");
      }
    }
  }

  window.copyToClipboard = copyToClipboard;

  function showAlert(message, type) {
    // Remove alerts existentes
    const existing = document.querySelectorAll(".alert");
    existing.forEach(alert => alert.remove());

    const alert = document.createElement("div");
    alert.className = `alert alert-${type}`;
    alert.textContent = message;
    alert.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      z-index: 10000;
      max-width: 400px;
      opacity: 0;
      transform: translateX(100%);
      transition: all 0.3s ease;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    `;

    document.body.appendChild(alert);

    // Mostrar com animação
    setTimeout(() => {
      alert.style.opacity = '1';
      alert.style.transform = 'translateX(0)';
    }, 10);

    // Remover automaticamente após 4 segundos
    setTimeout(() => {
      alert.style.opacity = '0';
      alert.style.transform = 'translateX(100%)';
      setTimeout(() => {
        if (alert.parentNode) {
          alert.remove();
        }
      }, 300);
    }, 4000);

    // Permitir fechar clicando
    alert.addEventListener('click', () => {
      alert.style.opacity = '0';
      alert.style.transform = 'translateX(100%)';
      setTimeout(() => {
        if (alert.parentNode) {
          alert.remove();
        }
      }, 300);
    });
  }

  // ===== FUNÇÕES PARA SELETOR DE IMAGENS DO SUPABASE STORAGE =====

  // Variáveis para controle do seletor de imagens
  let paginaAtual = 0;
  let imagensPorPagina = 20;
  let termoBusca = '';
  let bucketAtual = localStorage.getItem('supabase_bucket_name') || 'imagens_melhoradas_tech';
  let imagensCarregadas = [];
  let imagemSelecionada = null;

  // Função para abrir o seletor de imagens
  window.abrirSeletorImagens = function() {
    document.getElementById("seletorImagensModal").style.display = "block";
    
    // Atualizar o select com o bucket configurado
    const bucketSelect = document.getElementById("bucketSelect");
    if (bucketSelect) {
      bucketSelect.innerHTML = `<option value="${bucketAtual}">📁 ${bucketAtual}</option>`;
    }
    
    // Carregar imagens automaticamente ao abrir
    carregarImagens();
  };

  // Função para fechar o seletor de imagens
  window.fecharSeletorImagens = function() {
    document.getElementById("seletorImagensModal").style.display = "none";
    imagemSelecionada = null;
    limparSelecaoImagens();
  };

  // Função para carregar imagens do bucket
  window.carregarImagens = async function(resetarPagina = true) {
    if (resetarPagina) paginaAtual = 0;
    
    const loading = document.getElementById("loadingImagens");
    const grid = document.getElementById("imagensGrid");
    
    loading.style.display = "block";
    
    try {
      // Tentar primeiro com Supabase JS Client
      let imagens = null;
      
      if (supabaseInitialized && termoBusca === '') { // Supabase JS não suporta busca avançada
        console.log('🚀 Tentando carregar imagens via Supabase JS Client');
        imagens = await listImagesDirect(bucketAtual, '', imagensPorPagina, paginaAtual * imagensPorPagina);
      }
      
      // Fallback para API tradicional se Supabase JS falhar ou houver busca
      if (!imagens) {
        const url = `/storage/imagens?bucket=${bucketAtual}&limit=${imagensPorPagina}&offset=${paginaAtual * imagensPorPagina}&search=${encodeURIComponent(termoBusca)}`;
        console.log('📡 Fallback: fazendo requisição para API:', url);
        
        const response = await fetch(url);
        const data = await response.json();
        
        console.log('Resposta da API:', data);
        
        if (data.success) {
          imagens = data.imagens;
        } else {
          grid.innerHTML = `<p style="text-align: center; color: #e74c3c;">❌ Erro: ${data.error}</p>`;
          return;
        }
      }
      
      if (imagens) {
        imagensCarregadas = imagens;
        exibirImagens(imagens);
        atualizarPaginacao(imagens.length);
      }
      
    } catch (error) {
      console.error('❌ Erro ao carregar imagens:', error);
      grid.innerHTML = `<p style="text-align: center; color: #e74c3c;">❌ Erro de conexão: ${error.message}</p>`;
    } finally {
      loading.style.display = "none";
    }
  };

  // Função para exibir as imagens no grid
  function exibirImagens(imagens) {
    const grid = document.getElementById("imagensGrid");
    
    if (imagens.length === 0) {
      grid.innerHTML = `<p style="text-align: center; color: #666; grid-column: 1/-1;">📷 Nenhuma imagem encontrada</p>`;
      return;
    }
    
    grid.innerHTML = imagens.map((imagem, index) => `
      <div class="imagem-item" onclick="selecionarImagem('${imagem.url}', '${imagem.nome}', this)">
        <img id="img-${index}" src="${imagem.url}" alt="${imagem.nome}" 
             onerror="this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text y=%22.9em%22 font-size=%2290%22>❌</text></svg>'"
             onload="onImageLoad(this, '${imagem.caminho || imagem.nome}', ${index})">
        <div class="imagem-info">
          <div class="imagem-nome" title="${imagem.nome}">${imagem.nome}</div>
          <div class="imagem-tamanho">${formatarTamanho(imagem.tamanho)}</div>
        </div>
      </div>
    `).join('');
  }

  // Função chamada quando uma imagem é carregada (para otimização opcional)
  window.onImageLoad = async function(imgElement, imagePath, index) {
    // Se a imagem falhou ao carregar via URL pública, tentar download direto
    if (imgElement.naturalWidth === 0 && supabaseInitialized) {
      console.log(`🔄 Tentando download direto para: ${imagePath}`);
      
      const directUrl = await downloadImageDirect(imagePath, bucketAtual);
      if (directUrl) {
        imgElement.src = directUrl;
        console.log(`✅ Imagem carregada via download direto: ${imagePath}`);
      }
    }
  };

  // Função para selecionar uma imagem
  window.selecionarImagem = function(url, nome, elemento) {
    // Remover seleção anterior
    limparSelecaoImagens();
    
    // Adicionar seleção atual
    elemento.classList.add('selected');
    imagemSelecionada = { url, nome };
    
    // Aplicar imagem selecionada ao campo de edição
    document.getElementById("editarImagemUrl").value = url;
    updateImagePreview();
    
    // Fechar modal
    setTimeout(() => {
      fecharSeletorImagens();
      showAlert(`✅ Imagem "${nome}" selecionada!`, "success");
    }, 300);
  };

  // Função para limpar seleção de imagens
  function limparSelecaoImagens() {
    document.querySelectorAll('.imagem-item.selected').forEach(item => {
      item.classList.remove('selected');
    });
  }

  // Função de busca com debounce
  let timeoutBusca = null;
  window.buscarImagens = function() {
    clearTimeout(timeoutBusca);
    timeoutBusca = setTimeout(() => {
      termoBusca = document.getElementById("searchImagens").value.trim();
      carregarImagens(true);
    }, 500);
  };

  // Função para trocar bucket
  window.trocarBucket = function() {
    bucketAtual = document.getElementById("bucketSelect").value;
    termoBusca = '';
    document.getElementById("searchImagens").value = '';
    carregarImagens(true);
  };

  // Funções de paginação
  window.proximaPagina = function() {
    paginaAtual++;
    carregarImagens(false);
  };

  window.paginaAnterior = function() {
    if (paginaAtual > 0) {
      paginaAtual--;
      carregarImagens(false);
    }
  };

  // Função para atualizar controles de paginação
  function atualizarPaginacao(totalCarregado) {
    const paginacao = document.getElementById("paginacaoImagens");
    const btnAnterior = document.getElementById("btnAnterior");
    const btnProxima = document.getElementById("btnProxima");
    const infoPagina = document.getElementById("infoPagina");
    
    paginacao.style.display = "block";
    
    btnAnterior.disabled = paginaAtual === 0;
    btnProxima.disabled = totalCarregado < imagensPorPagina;
    
    infoPagina.textContent = `Página ${paginaAtual + 1}`;
  }

  // Função auxiliar para formatar tamanho do arquivo
  function formatarTamanho(bytes) {
    if (!bytes || bytes === 0) return 'N/A';
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
  }

  // Fechar modal ao clicar fora dele
  window.addEventListener('click', function(event) {
    const seletorModal = document.getElementById("seletorImagensModal");
    if (event.target === seletorModal) {
      fecharSeletorImagens();
    }
  });

  // Carregar configurações ao inicializar a página
  carregarConfiguracoes();

});

// Funções de Configuração
function carregarConfiguracoes() {
  // Carregar configurações do localStorage
  const bucketName = localStorage.getItem('supabase_bucket_name') || 'imagens_melhoradas_tech';
  const supabaseUrl = localStorage.getItem('supabase_url') || '';
  
  // Verificar se os elementos existem antes de definir valores
  const bucketInput = document.getElementById('bucketName');
  const urlInput = document.getElementById('supabaseUrl');
  
  if (bucketInput) bucketInput.value = bucketName;
  if (urlInput) urlInput.value = supabaseUrl;
  
  // Atualizar a variável do bucket atual se existir
  if (typeof bucketAtual !== 'undefined') {
    bucketAtual = bucketName;
  }
}

function salvarConfiguracoes() {
  const bucketName = document.getElementById('bucketName').value.trim();
  const supabaseUrl = document.getElementById('supabaseUrl').value.trim();
  
  if (!bucketName) {
    mostrarStatusConfig('❌ Nome do bucket é obrigatório!', 'error');
    return;
  }
  
  // Salvar no localStorage
  localStorage.setItem('supabase_bucket_name', bucketName);
  localStorage.setItem('supabase_url', supabaseUrl);
  
  // Atualizar a variável do bucket atual
  if (typeof bucketAtual !== 'undefined') {
    bucketAtual = bucketName;
  }
  
  // Salvar no servidor (opcional - pode implementar endpoint para salvar no .env)
  mostrarStatusConfig('✅ Configurações salvas com sucesso!', 'success');
}

async function testarConexao() {
  const bucketName = document.getElementById('bucketName').value.trim();
  
  if (!bucketName) {
    mostrarStatusConfig('❌ Nome do bucket é obrigatório para testar a conexão!', 'error');
    return;
  }
  
  mostrarStatusConfig('🔄 Testando conexão...', 'info');
  
  try {
    // Primeiro, tentar com Supabase JS Client
    if (supabaseInitialized) {
      console.log('🧪 Testando com Supabase JS Client...');
      const imagensJS = await listImagesDirect(bucketName, '', 1, 0);
      
      if (imagensJS && imagensJS.length >= 0) {
        mostrarStatusConfig(`✅ Conexão via Supabase JS bem-sucedida! ${imagensJS.length} imagem(ns) encontrada(s).`, 'success');
        return;
      }
    }
    
    // Fallback para API tradicional
    console.log('🧪 Testando com API tradicional...');
    const response = await fetch('/storage/imagens?' + new URLSearchParams({
      bucket: bucketName,
      limit: 1
    }));
    
    const data = await response.json();
    
    if (data.success) {
      mostrarStatusConfig('✅ Conexão via API bem-sucedida! Bucket encontrado.', 'success');
    } else {
      mostrarStatusConfig('❌ Erro na conexão: ' + data.error, 'error');
    }
    
  } catch (error) {
    mostrarStatusConfig('❌ Erro ao testar conexão: ' + error.message, 'error');
  }
}

function mostrarStatusConfig(message, type) {
  const statusDiv = document.getElementById('configStatus');
  statusDiv.style.display = 'block';
  statusDiv.textContent = message;
  
  // Definir cores baseadas no tipo
  switch (type) {
    case 'success':
      statusDiv.style.backgroundColor = '#d4edda';
      statusDiv.style.color = '#155724';
      statusDiv.style.border = '1px solid #c3e6cb';
      break;
    case 'error':
      statusDiv.style.backgroundColor = '#f8d7da';
      statusDiv.style.color = '#721c24';
      statusDiv.style.border = '1px solid #f5c6cb';
      break;
    case 'info':
      statusDiv.style.backgroundColor = '#d1ecf1';
      statusDiv.style.color = '#0c5460';
      statusDiv.style.border = '1px solid #bee5eb';
      break;
  }
  
  // Auto-ocultar após 5 segundos para mensagens de sucesso
  if (type === 'success') {
    setTimeout(() => {
      statusDiv.style.display = 'none';
    }, 5000);
  }
}
