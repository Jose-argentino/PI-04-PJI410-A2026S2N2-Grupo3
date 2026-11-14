// URL do Firestore REST API da Estação Meteorológica
const URL_FIRESTORE = "https://firestore.googleapis.com/v1/projects/gen-lang-client-0853696923/databases/ai-studio-remixagroirrigam-5a5bb94c-bad7-4521-b4d3-c959f2e7b3a6/documents:runQuery?key=AIzaSyAafzTja9e_zsRTK3HfoI0hwXGcygbAQiE";

// Seleção de Elementos DOM
const refreshBtn = document.getElementById("refresh-btn");
const currentDateEl = document.getElementById("current-date");
const temperatureEl = document.getElementById("temperature"); // Umidade do Solo em Destaque
const weatherDescriptionEl = document.getElementById("weather-description");
const weatherIconEl = document.getElementById("weather-icon");

const tempAirEl = document.getElementById("temp-air");
const humidityAirEl = document.getElementById("humidity-air");
const pressureValEl = document.getElementById("pressure-val");
const rainStatusEl = document.getElementById("rain-status");
const rainIconEl = document.getElementById("rain-icon");
const statusMessage = document.getElementById("status-message");
const debugJsonEl = document.getElementById("debug-json");

// Função para tratar tipos de dados do Firestore
function decodificar(campo) {
  if (!campo || typeof campo !== "object") return campo;
  if ("doubleValue" in campo) return parseFloat(campo.doubleValue);
  if ("integerValue" in campo) return parseInt(campo.integerValue, 10);
  if ("stringValue" in campo) return campo.stringValue;
  if ("booleanValue" in campo) return Boolean(campo.booleanValue);
  return null;
}

// Utilitários de Interface
function showStatus(message, isLoading = false) {
  statusMessage.textContent = message;
  statusMessage.className = "status-message" + (isLoading ? " loading" : "");
}

function hideStatus() {
  statusMessage.className = "status-message hidden";
}

/**
 * Converte o valor cru (soilRaw1) em porcentagem usando a fórmula de calibração:
 * Porcentagem = -0.182 * L + 163.6 (com limite de segurança entre 0% e 100%)
 */
function calcularUmidadePorRaw(raw) {
  const L = Number(raw);
  if (isNaN(L) || L <= 0) return 0.0;

  // Aplicação da fórmula informada pela equipe
  let porcentagem = (-0.182 * L) + 163.6;

  // Garante que o valor fique estritamente entre 0% e 100%
  return Math.max(0, Math.min(100, porcentagem));
}

// Avalia a Umidade do Solo para fornecer um indicador dinâmico
function avaliarUmidadeSolo(porcentagem) {
  if (porcentagem < 30) {
    return { status: "Solo Seco (Irrigar)", icon: "ph-drop-slash" };
  } else if (porcentagem <= 70) {
    return { status: "Solo Ideal", icon: "ph-drop-half" };
  } else {
    return { status: "Solo Encharcado", icon: "ph-drop" };
  }
}

// Função de Busca dos Dados da Estação
async function buscarDadosEstacao() {
  try {
    showStatus("Lendo dados da estação...", true);

    const payload = {
      structuredQuery: {
        from: [{ collectionId: "telemetry" }],
        orderBy: [{ field: { fieldPath: "timestamp" }, direction: "DESCENDING" }],
        limit: 1
      }
    };

    const response = await fetch(URL_FIRESTORE, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      throw new Error("Erro na conexão com a estação meteorológica.");
    }

    const resultado = await response.json();

    if (!resultado || !resultado[0] || !resultado[0].document) {
      throw new Error("Nenhuma leitura encontrada na estação.");
    }

    const campos = resultado[0].document.fields || {};

    // Depuração opcional no console para acompanhar os valores crus
    let objetoBrutoParaDebug = {};
    for (let chave in campos) {
      objetoBrutoParaDebug[chave] = decodificar(campos[chave]);
    }
    console.log("Dados recebidos da estação:", objetoBrutoParaDebug);

    // Extração do Horário
    let horario = decodificar(campos.horaLeitura) || 
                  decodificar(campos.createdAtIso) || 
                  resultado[0].document.createTime;

    if (horario) {
      const dataObj = new Date(horario);
      if (!isNaN(dataObj)) {
        horario = dataObj.toLocaleString("pt-BR", {
          day: "2-digit",
          month: "2-digit",
          hour: "2-digit",
          minute: "2-digit"
        });
      }
    }

    // Processamento do Solo: IGNORA o 'soil' travado em 100 e calcula usando o 'soilRaw1' (L)
    const rawSolo1 = decodificar(campos.soilRaw1) ?? decodificar(campos.soil) ?? 0;
    const umidadeCalculada = calcularUmidadePorRaw(rawSolo1);

    // Processamento dos Sensores
    const dados = {
      horario: horario || "Recente",
      temperatura: Number(decodificar(campos.temp) || 0).toFixed(1),
      umidadeAr: Number(decodificar(campos.hum) || 0).toFixed(1),
      pressao: Number(decodificar(campos.pabs) || 1013.2).toFixed(1),
      umidadeSolo: umidadeCalculada.toFixed(1),
      precipitacao: Boolean(decodificar(campos.rain))
    };

    // Atualização do HTML
    atualizarInterface(dados);
    hideStatus();

  } catch (error) {
    showStatus(error.message, false);
  }
}

function atualizarInterface(dados) {
  // Data / Hora
  currentDateEl.textContent = `Leitura: ${dados.horario}`;

  // Destaque Principal: Umidade do Solo
  temperatureEl.textContent = Math.round(dados.umidadeSolo);
  
  const avaliacao = avaliarUmidadeSolo(dados.umidadeSolo);
  weatherDescriptionEl.textContent = avaliacao.status;
  weatherIconEl.className = `ph ${avaliacao.icon}`;

  // Sensores Secundários
  tempAirEl.textContent = `${dados.temperatura} °C`;
  humidityAirEl.textContent = `${dados.umidadeAr}%`;
  pressureValEl.textContent = `${dados.pressao} hPa`;

  // Status de Chuva
  if (dados.precipitacao) {
    rainStatusEl.textContent = "Chovendo";
    rainIconEl.className = "ph ph-cloud-rain";
  } else {
    rainStatusEl.textContent = "Sem Chuva";
    rainIconEl.className = "ph ph-sun";
  }
}

// Eventos
refreshBtn.addEventListener("click", buscarDadosEstacao);

// Leitura inicial ao carregar a página
buscarDadosEstacao();