// URL do Firestore REST API da Estação
const URL_FIRESTORE = "https://firestore.googleapis.com/v1/projects/gen-lang-client-0853696923/databases/ai-studio-remixagroirrigam-5a5bb94c-bad7-4521-b4d3-c959f2e7b3a6/documents:runQuery?key=AIzaSyAafzTja9e_zsRTK3HfoI0hwXGcygbAQiE";

const statusMessage = document.getElementById("status-message");
const currentDateEl = document.getElementById("current-date");

function showStatus(message, isLoading = false) {
  statusMessage.textContent = message;
  statusMessage.className = "status-message" + (isLoading ? " loading" : "");
}

function hideStatus() {
  statusMessage.className = "status-message hidden";
}

// Função auxiliar para decodificar tipos do Firestore REST
function decodificar(campo) {
  if (!campo || typeof campo !== "object") return campo;
  if ("doubleValue" in campo) return parseFloat(campo.doubleValue);
  if ("integerValue" in campo) return parseInt(campo.integerValue, 10);
  if ("stringValue" in campo) return campo.stringValue;
  if ("booleanValue" in campo) return Boolean(campo.booleanValue);
  return null;
}

async function buscarHistoricoSolo() {
  try {
    showStatus("Buscando histórico dos últimos dias...", true);

    // Ajuste o limit conforme a quantidade de leituras que você quer trazer (ex: 50 ou 100 últimas leituras)
    const payload = {
      structuredQuery: {
        from: [{ collectionId: "telemetry" }],
        orderBy: [{ field: { fieldPath: "timestamp" }, direction: "DESCENDING" }],
        limit: 200
      }
    };

    const response = await fetch(URL_FIRESTORE, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      throw new Error("Erro ao conectar com o banco de dados do Firestore.");
    }

    const resultado = await response.json();

    if (!resultado || resultado.length === 0 || !resultado[0].document) {
      throw new Error("Nenhum registro encontrado na telemetria.");
    }

    // Processar os documentos retornados
    let labels = [];
    let dadosUmidade = [];

    // O Firestore retorna do mais recente para o mais antigo, invertemos para exibir cronologicamente no gráfico
    resultado.reverse().forEach(item => {
      const campos = item.document.fields || {};
      
      let horario = decodificar(campos.horaLeitura) || 
                    decodificar(campos.createdAtIso) || 
                    item.document.createTime;

      if (horario) {
        const dataObj = new Date(horario);
        if (!isNaN(dataObj)) {
          // Formata a data/hora para o eixo X do gráfico
          horario = dataObj.toLocaleDateString("pt-BR", {
            day: "2-digit",
            month: "2-digit",
            hour: "2-digit",
            minute: "2-digit"
          });
        }
      }

      const soilVal = Number(decodificar(campos.soil) || 0).toFixed(1);

      labels.push(horario || "Desconhecido");
      dadosUmidade.push(soilVal);
    });

    currentDateEl.textContent = "Dados carregados com sucesso.";
    hideStatus();

    // Renderizar o Gráfico com Chart.js
    renderizarGrafico(labels, dadosUmidade);

  } catch (error) {
    showStatus(error.message, false);
  }
}

function renderizarGrafico(labels, dados) {
  const ctx = document.getElementById('soilHistoryChart').getContext('2d');
  
  new Chart(ctx, {
    type: 'line',
    data: {
      labels: labels,
      datasets: [{
        label: 'Umidade do Solo (%)',
        data: dados,
        borderColor: '#38bdf8',
        backgroundColor: 'rgba(56, 189, 248, 0.15)',
        borderWidth: 2,
        pointBackgroundColor: '#38bdf8',
        pointRadius: 2,
        fill: true,
        tension: 0.3
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          labels: {
            color: '#f8fafc',
            font: { family: "'Segoe UI', sans-serif" }
          }
        }
      },
      scales: {
        x: {
          ticks: { color: '#94a3b8', maxTicksLimit: 8 },
          grid: { color: 'rgba(255, 255, 255, 0.05)' }
        },
        y: {
          beginAtZero: true,
          max: 100,
          ticks: { color: '#94a3b8' },
          grid: { color: 'rgba(255, 255, 255, 0.05)' }
        }
      }
    }
  });
}
// Executa a busca ao carregar a página
buscarHistoricoSolo();