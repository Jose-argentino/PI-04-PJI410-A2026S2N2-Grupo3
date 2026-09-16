/* ==========================================================================
   1. TRADUÇÃO DOS CÓDIGOS DA OPEN-METEO
   A API envia números (códigos WMO) para o clima. Traduzimos para Português
   e associamos ao ícone correto.
   ========================================================================== */
const weatherCodeMap = {
  0: { description: "Céu Limpo", icon: "ph-sun" },
  1: { description: "Predominantemente Limpo", icon: "ph-sun-dim" },
  2: { description: "Parcialmente Nublado", icon: "ph-cloud-sun" },
  3: { description: "Ensolarado / Nublado", icon: "ph-cloud" },
  45: { description: "Névoa", icon: "ph-cloud-fog" },
  51: { description: "Garoa Leve", icon: "ph-cloud-drizzle" },
  61: { description: "Chuva Leve", icon: "ph-cloud-rain" },
  63: { description: "Chuva Moderada", icon: "ph-cloud-rain" },
  80: { description: "Pancadas de Chuva", icon: "ph-cloud-sun-rain" },
  95: { description: "Trovoada", icon: "ph-cloud-lightning" }
};

/* ==========================================================================
   2. SELEÇÃO DOS ELEMENTOS DO HTML
   Capturamos os elementos para poder alterar os textos e números via JS.
   ========================================================================== */
const cityInput = document.getElementById("city-input");
const searchBtn = document.getElementById("search-btn");
const cityNameEl = document.getElementById("city-name");
const currentDateEl = document.getElementById("current-date");
const temperatureEl = document.getElementById("temperature");
const weatherDescriptionEl = document.getElementById("weather-description");
const weatherIconEl = document.getElementById("weather-icon");
const windSpeedEl = document.getElementById("wind-speed");
const humidityEl = document.getElementById("humidity");
const forecastContainer = document.getElementById("forecast-container");
const statusMessage = document.getElementById("status-message");

/* ==========================================================================
   3. FUNÇÕES UTILITÁRIAS
   ========================================================================== */

// Exibe avisos de "Carregando..." ou erros na tela
function showStatus(message, isLoading = false) {
  statusMessage.textContent = message;
  statusMessage.className = "status-message" + (isLoading ? " loading" : "");
}

function hideStatus() {
  statusMessage.className = "status-message hidden";
}

// Coloca a data formatada no topo do widget
function updateCurrentDate() {
  const now = new Date();
  const options = { weekday: 'long', day: 'numeric', month: 'long' };
  currentDateEl.textContent = now.toLocaleDateString('pt-BR', options);
}

/* ==========================================================================
   4. CONSULTAS ÀS APIs (OPEN-METEO)
   ========================================================================== */

// Passo A: Transforma o NOME da cidade em LATITUDE e LONGITUDE
async function fetchCoordinates(cityName) {
  const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(cityName)}&count=1&language=pt&format=json`;
  
  const response = await fetch(url);
  const data = await response.json();

  if (!data.results || data.results.length === 0) {
    throw new Error("Cidade não encontrada. Verifique o nome digitado.");
  }

  const location = data.results[0];
  const fullName = `${location.name}${location.admin1 ? ', ' + location.admin1 : ''}`;

  return {
    latitude: location.latitude,
    longitude: location.longitude,
    name: fullName
  };
}

// Passo B: Busca a temperatura e clima usando as coordenadas obtidas
async function fetchWeatherData(lat, lon) {
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m&daily=weather_code,temperature_2m_max,temperature_2m_min&timezone=auto`;

  const response = await fetch(url);
  return await response.json();
}

/* ==========================================================================
   5. ATUALIZAR A INTERFACE COM OS DADOS DA API
   ========================================================================== */
function updateUI(locationName, weatherData) {
  // Atualiza Nome da Cidade
  cityNameEl.querySelector("span").textContent = locationName;

  // Atualiza Dados Atuais
  const current = weatherData.current;
  temperatureEl.textContent = Math.round(current.temperature_2m);
  windSpeedEl.textContent = `${Math.round(current.wind_speed_10m)} km/h`;
  humidityEl.textContent = `${current.relative_humidity_2m}%`;

  // Define descrição e ícone
  const info = weatherCodeMap[current.weather_code] || { description: "Ensolarado", icon: "ph-sun" };
  weatherDescriptionEl.textContent = info.description;
  weatherIconEl.className = `ph ${info.icon}`;

  // Gera a Previsão dos Próximos 5 Dias
  forecastContainer.innerHTML = "";
  const daily = weatherData.daily;

  for (let i = 1; i <= 5; i++) {
    const dateStr = daily.time[i];
    const code = daily.weather_code[i];
    const max = Math.round(daily.temperature_2m_max[i]);
    const min = Math.round(daily.temperature_2m_min[i]);

    // Extrai o dia da semana (ex: Ter, Qua)
    const dateObj = new Date(dateStr + "T00:00:00");
    const dayName = dateObj.toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', '');

    const dayInfo = weatherCodeMap[code] || { icon: "ph-sun" };

    // Insere o card individual de cada dia
    forecastContainer.innerHTML += `
      <div class="forecast-card">
        <p class="day">${dayName}</p>
        <i class="ph ${dayInfo.icon}"></i>
        <p class="temp">${max}° / ${min}°</p>
      </div>
    `;
  }
}

/* ==========================================================================
   6. EXECUÇÃO DA BUSCA
   ========================================================================== */
async function searchWeather(cityName) {
  if (!cityName.trim()) return;

  try {
    showStatus("Buscando clima...", true);

    const coords = await fetchCoordinates(cityName);
    const data = await fetchWeatherData(coords.latitude, coords.longitude);

    updateUI(coords.name, data);
    hideStatus();
  } catch (error) {
    showStatus(error.message, false);
  }
}

/* ==========================================================================
   7. EVENTOS (Cliques e Teclas)
   ========================================================================== */
searchBtn.addEventListener("click", () => searchWeather(cityInput.value));

cityInput.addEventListener("keyup", (e) => {
  if (e.key === "Enter") searchWeather(cityInput.value);
});

// Inicialização ao abrir a página
updateCurrentDate();
searchWeather("São Paulo");