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

// Converte o valor bruto (raw) do sensor em porcentagem usando a fórmula de calibração
function calcularUmidadePorRaw(raw) {
  const L = Number(raw);
  if (isNaN(L) || L <= 0) return 0.0;
  let porcentagem = (-0.182 * L) + 163.6;
  return Math.max(0, Math.min(100, porcentagem));
}

async function buscarHistoricoSolo() {
  try {
    showStatus("Buscando histórico dos sensores...", true);

    const payload = {
      structuredQuery: {
        from: [{ collectionId: "telemetry" }],
        orderBy: [{ field: { fieldPath: "timestamp" }, direction: "DESCENDING" }],
        limit: 100
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

    let labels = [];
    let dadosMedia = [];
    let dados15 = [];
    let dados30 = [];

    // O Firestore retorna do mais recente para o mais antigo, invertemos para exibir cronologicamente
    resultado.reverse().forEach(item => {
      const campos = item.document.fields || {};
      
      let horario = decodificar(campos.horaLeitura) || 
                    decodificar(campos.createdAtIso) || 
                    item.document.createTime;

      if (horario) {
        const dataObj = new Date(horario);
        if (!isNaN(dataObj)) {
          horario = dataObj.toLocaleDateString("pt-BR", {
            day: "2-digit",
            month: "2-digit",
            hour: "2-digit",
            minute: "2-digit"
          });
        }
      }

      // Obtém os valores crus (raw) de cada sensor
      const raw1 = decodificar(campos.soilRaw1) ?? decodificar(campos.soil) ?? 0;
      const raw2 = decodificar(campos.soilRaw2) ?? decodificar(campos.soil) ?? 0;

      const val1 = calcularUmidadePorRaw(raw1);
      const val2 = calcularUmidadePorRaw(raw2);
      const media = (val1 + val2) / 2;

      labels.push(horario || "Desconhecido");
      dadosMedia.push(media.toFixed(1));
      dados15.push(val1.toFixed(1));
      dados30.push(val2.toFixed(1));
    });

    currentDateEl.textContent = "Histórico carregado com sucesso.";
    hideStatus();

    // Renderizar os 3 gráficos independentes com Chart.js
    renderizarGrafico('soilMediaChart', 'Média dos Sensores (%)', labels, dadosMedia, '#38bdf8', 'rgba(56, 189, 248, 0.15)');
    // renderizarGrafico('soil15Chart', 'Sensor 15 cm (soilRaw1) (%)', labels, dados15, '#10b981', 'rgba(16, 185, 129, 0.15)');
    // renderizarGrafico('soil30Chart', 'Sensor 30 cm (soilRaw2) (%)', labels, dados30, '#f59e0b', 'rgba(245, 158, 11, 0.15)');

  } catch (error) {
    showStatus(error.message, false);
  }
}

function renderizarGrafico(canvasId, labelNome, labels, dados, corBorda, corFundo) {
  const ctx = document.getElementById(canvasId).getContext('2d');
  
  new Chart(ctx, {
    type: 'line',
    data: {
      labels: labels,
      datasets: [{
        label: labelNome,
        data: dados,
        borderColor: corBorda,
        backgroundColor: corFundo,
        borderWidth: 2,
        pointBackgroundColor: corBorda,
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