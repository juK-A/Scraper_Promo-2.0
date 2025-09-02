// /mercado_livre_scraper/app/static/script.js

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

  // Resetar preview
  updateImagePreview();

  // Buscar dados atuais do produto
  fetch(`/produtos/${produtoId}`, { method: "GET" })
    .then((response) => response.json())
    .then((data) => {
      if (data.success) {
        const produto = data.produto;
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
    });

  document.getElementById("editarModal").style.display = "block";
};

window.closeEditModal = function () {
  document.getElementById("editarModal").style.display = "none";
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

    card.innerHTML = `
        <div class="product-header">
          <img src="${imagemComCache}" alt="${produto.titulo}" class="product-image">
          <div class="product-info">
            <div class="product-title">${produto.titulo}</div>
            <div class="product-price-atual">${produto.preco_atual}</div>
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

        const response = await fetch(`/produtos/${produtoId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(dadosEdicao),
        });

        const data = await response.json();
        if (response.ok) {
          showAlert(data.message, "success");
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
});
