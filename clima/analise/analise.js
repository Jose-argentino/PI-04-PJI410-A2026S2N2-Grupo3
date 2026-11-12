// URL Firestore REST API do seu projeto
const URL_FIRESTORE = "https://firestore.googleapis.com/v1/projects/gen-lang-client-0853696923/databases/ai-studio-remixagroirrigam-5a5bb94c-bad7-4521-b4d3-c959f2e7b3a6/documents:runQuery?key=AIzaSyAafzTja9e_zsRTK3HfoI0hwXGcygbAQiE";

const statusMessage = document.getElementById("status-message");
const currentDateEl = document.getElementById("current-date");

function decodificar(campo) {
  if (!campo || typeof campo !== "object") return campo;
  if ("doubleValue" in campo) return parseFloat(campo.doubleValue);
  if ("integerValue" in campo) return parseInt(campo.integerValue, 10);
  if ("stringValue" in campo) return campo.stringValue;
  if ("booleanValue" in campo) return Boolean(campo.booleanValue);
  return null;
}

// ALGORITMO DE MACHINE LEARNING: Regressão Linear Simples

function treinarModeloRegressao(x, y) {
  const n = x.length;
  let sumX = 0, sumY = 0, sumXY = 0, sumXX = 0;

  for (let i = 0; i < n; i++) {
    sumX += x[i];
    sumY += y[i];
    sumXY += x[i] * y[i];
    sumXX += x[i] * x[i];
  }

  const inclinacao = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
  const intercepto = (sumY - inclinacao * sumX) / n;

  return {
    prever: (novoX) => Math.max(0, Math.min(100, inclinacao * novoX + intercepto)),
    inclinacao: inclinacao
  };
}

async function carregarEPrever() {
  try {
    statusMessage.textContent = "Carregando telemetria e calculando tendência ML...";
    statusMessage.className = "status-message loading";

    const payload = {
      structuredQuery: {
        from: [{ collectionId: "telemetry" }],
        orderBy: [{ field: { fieldPath: "timestamp" }, direction: "DESCENDING" }],
        limit: 24 
      }
    };

    const response = await fetch(URL_FIRESTORE, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    const resultado = await response.json();
    if (!resultado || !resultado[0] || !resultado[0].document) {
      throw new Error("Nenhum dado encontrado no banco.");
    }

    const leituras = resultado.reverse();

    let labelsHistorico = [];
    let dadosHistorico = [];
    let dadosEixoX = [];
    let chuvaRecente = false;

    leituras.forEach((item, index) => {
      const campos = item.document.fields || {};
      let hora = decodificar(campos.horaLeitura) || decodificar(campos.createdAtIso) || item.document.createTime;
      
      if (hora) {
        const d = new Date(hora);
        if (!isNaN(d)) hora = d.toLocaleTimeString("pt-BR", { hour: '2-digit', minute: '2-digit' });
      }

      let umidade = Number(decodificar(campos.soil) || 0);
      if (Boolean(decodificar(campos.rain))) chuvaRecente = true;

      labelsHistorico.push(hora || `H-${24 - index}`);
      dadosHistorico.push(umidade);
      dadosEixoX.push(index);
    });

    const modelo = treinarModeloRegressao(dadosEixoX, dadosHistorico);

    let labelsPrevisao = [];
    let dadosPrevisao = [];
    let ultimoEixoX = dadosEixoX[dadosEixoX.length - 1];

    dadosPrevisao.push(dadosHistorico[dadosHistorico.length - 1]);

    for (let i = 1; i <= 6; i++) {
      let valorFuturo = modelo.prever(ultimoEixoX + i);
      dadosPrevisao.push(Number(valorFuturo.toFixed(1)));
      labelsPrevisao.push(`+${i}h`);
    }

    const todosLabels = [...labelsHistorico, ...labelsPrevisao];
    const datasetHistoricoAlinhado = [...dadosHistorico, ...Array(6).fill(null)];
    const datasetPrevisaoAlinhado = [...Array(dadosHistorico.length - 1).fill(null), ...dadosPrevisao];

    const menorUmidadePrevista = Math.min(...dadosPrevisao);
    const umidadeAtual = dadosHistorico[dadosHistorico.length - 1];

    atualizarRecomendacao(umidadeAtual, menorUmidadePrevista, chuvaRecente, modelo.inclinacao);
    renderizarGrafico(todosLabels, datasetHistoricoAlinhado, datasetPrevisaoAlinhado);

    currentDateEl.textContent = "Previsão atualizada com sucesso.";
    statusMessage.className = "status-message hidden";

  } catch (error) {
    statusMessage.textContent = error.message;
    statusMessage.className = "status-message";
  }
}

function atualizarRecomendacao(atual, prevista, chovendo, inclinacao) {
  const box = document.getElementById("recommendation-box");
  const icon = document.getElementById("rec-icon");
  const title = document.getElementById("rec-title");
  const desc = document.getElementById("rec-desc");

  if (prevista < 30 || atual < 30) {
    box.className = "recommendation-card status-red";
    icon.className = "ph ph-warning-octagon";
    title.textContent = "Irrigação Necessária!";
    desc.textContent = `A umidade prevista para as próximas horas é de ${prevista}%. Solo entrará em estado crítico de seca.`;
  } 
  else if (prevista <= 50 || (inclinacao < -1.5 && !chovendo)) {
    box.className = "recommendation-card status-yellow";
    icon.className = "ph ph-warning";
    title.textContent = "Atenção: Intervenção em breve";
    desc.textContent = `Tendência de queda acentuada. Umidade projetada: ${prevista}%. Verifique a previsão do tempo antes de acionar.`;
  } 
  else {
    box.className = "recommendation-card status-green";
    icon.className = "ph ph-check-circle";
    title.textContent = "Não necessita de irrigação";
    desc.textContent = `Solo em ótimas condições! A umidade prevista para as próximas 6 horas se manterá estável em ~${prevista}%.`;
  }
}

function renderizarGrafico(labels, dadosReais, dadosPrevistos) {
  const ctx = document.getElementById('forecastChart').getContext('2d');
  
  new Chart(ctx, {
    type: 'line',
    data: {
      labels: labels,
      datasets: [
        {
          label: 'Últimas 24h (Real)',
          data: dadosReais,
          borderColor: '#38bdf8',
          backgroundColor: 'rgba(56, 189, 248, 0.15)',
          borderWidth: 2,
          pointRadius: 2,
          fill: true,
          tension: 0.2
        },
        {
          label: 'Próximas 6h (Previsão IA)',
          data: dadosPrevistos,
          borderColor: '#f59e0b',
          borderDash: [6, 6],
          backgroundColor: 'rgba(245, 158, 11, 0.1)',
          borderWidth: 2,
          pointRadius: 2,
          fill: true,
          tension: 0.1
        }
      ]
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
          grid: { color: 'rgba(255, 255, 255, 0.05)' },
          title: { display: true, text: 'Umidade do Solo (%)', color: '#94a3b8' }
        }
      }
    }
  });
}

carregarEPrever();