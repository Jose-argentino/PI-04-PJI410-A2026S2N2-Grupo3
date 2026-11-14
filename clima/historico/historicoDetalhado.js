// URL do Firestore REST API da Estação Meteorológica
const URL_FIRESTORE = "https://firestore.googleapis.com/v1/projects/gen-lang-client-0853696923/databases/ai-studio-remixagroirrigam-5a5bb94c-bad7-4521-b4d3-c959f2e7b3a6/documents:runQuery?key=AIzaSyAafzTja9e_zsRTK3HfoI0hwXGcygbAQiE";

const statusMessage = document.getElementById("status-message");
const currentDateEl = document.getElementById("current-date");
const tableBody = document.getElementById("table-body");

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

// Converte o valor bruto (raw) do solo em porcentagem usando a fórmula de calibração
function calcularUmidadePorRaw(raw) {
  const L = Number(raw);
  if (isNaN(L) || L <= 0) return 0.0;
  let porcentagem = (-0.182 * L) + 163.6;
  return Math.max(0, Math.min(100, porcentagem));
}

async function buscarHistoricoCompleto() {
  try {
    showStatus("Buscando dados detalhados da estação...", true);

    const payload = {
      structuredQuery: {
        from: [{ collectionId: "telemetry" }],
        orderBy: [{ field: { fieldPath: "timestamp" }, direction: "DESCENDING" }],
        limit: 1250 
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

    tableBody.innerHTML = ""; // Limpa a tabela

    resultado.forEach(item => {
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
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit"
          });
        }
      }

      // Sensores de Solo
      const raw1 = decodificar(campos.soilRaw1) ?? decodificar(campos.soil) ?? 0;
      const raw2 = decodificar(campos.soilRaw2) ?? decodificar(campos.soil) ?? 0;
      const soil15 = calcularUmidadePorRaw(raw1);
      const soil30 = calcularUmidadePorRaw(raw2);
      const mediaSolo = (soil15 + soil30) / 2;

      // Sensores Ambientais
      const tempVal = Number(decodificar(campos.temp) || 0).toFixed(1);
      const humVal = Number(decodificar(campos.hum) || 0).toFixed(1);
      const pressaoVal = Number(decodificar(campos.pabs) || 1013.2).toFixed(1);

     
      // Tratamento inteligente e sensível de chuva
      const rainRaw = decodificar(campos.rainRaw) ?? 4095;
      const digitalChuva = decodificar(campos.digitalChuva);
      const boolChuvaOriginal = Boolean(decodificar(campos.rain));
      
      // Considera chuva se o pino digital for 0 OU se o valor analógico cair abaixo de 3800 (mais sensível) OU se o booleano original for true
      const chovendo = (digitalChuva === 0) || (rainRaw < 3800) || boolChuvaOriginal;
      const statusChuva = chovendo ? "Chovendo 🌧️" : "Sem Chuva ☀️";

      // Bateria
      const batteryPercent = decodificar(campos.batteryPercent) ?? decodificar(campos.battery) ?? "-";

      // Criação da linha da tabela (sem contador de pacotes e sem os textos Raw)
      const row = document.createElement("tr");
      
      row.innerHTML = `
        <td>${horario || "Desconhecido"}</td>
        <td style="font-weight: bold; color: #10b981;">${soil15.toFixed(1)}%</td>
        <td style="font-weight: bold; color: #f59e0b;">${soil30.toFixed(1)}%</td>
        <td style="font-weight: bold; color: #38bdf8;">${mediaSolo.toFixed(1)}%</td>
        <td>${tempVal} °C</td>
        <td>${humVal}%</td>
        <td>${pressaoVal} hPa</td>
        <td>${statusChuva}</td>
        <td>${batteryPercent}%</td>
      `;

      tableBody.appendChild(row);
    });

    currentDateEl.textContent = "Exibindo as leituras detalhadas e registros da estação.";
    hideStatus();

  } catch (error) {
    showStatus(error.message, false);
  }
}

// Executa ao carregar
buscarHistoricoCompleto();