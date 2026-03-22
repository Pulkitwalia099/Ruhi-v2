import { findMemoryByKey } from "@/db/queries";
import type { ProactiveAction } from "./product-followup";

interface WeatherData {
  temperature: number;
  humidity: number;
  uvIndex: number;
  description: string;
}

const OPEN_METEO_BASE = "https://api.open-meteo.com/v1";
const GEOCODE_BASE = "https://geocoding-api.open-meteo.com/v1";

/**
 * Check if there's a notable weather change worth a skincare tip.
 * Compares today vs 3-day average. Only sends if genuinely helpful.
 */
export async function checkWeatherTip(
  userId: string,
): Promise<ProactiveAction | null> {
  // Get user's city from memory
  const cityMemory = await findMemoryByKey({
    userId,
    category: "identity",
    key: "city",
  });

  if (!cityMemory) return null;

  try {
    // Geocode the city
    const coords = await geocodeCity(cityMemory.value);
    if (!coords) return null;

    // Fetch current + 3-day history
    const today = await fetchWeather(coords.lat, coords.lon, 0);
    const history = await fetch3DayAverage(coords.lat, coords.lon);

    if (!today || !history) return null;

    // Check for significant changes
    const tip = evaluateWeatherChange(cityMemory.value, today, history);
    return tip;
  } catch (error) {
    console.error("[WeatherTip] Failed:", error);
    return null;
  }
}

async function geocodeCity(
  city: string,
): Promise<{ lat: number; lon: number } | null> {
  const res = await fetch(
    `${GEOCODE_BASE}/search?name=${encodeURIComponent(city)}&count=1&language=en`,
  );
  if (!res.ok) return null;

  const data = await res.json();
  const result = data.results?.[0];
  if (!result) return null;

  return { lat: result.latitude, lon: result.longitude };
}

async function fetchWeather(
  lat: number,
  lon: number,
  daysBack: number,
): Promise<WeatherData | null> {
  const params = new URLSearchParams({
    latitude: lat.toString(),
    longitude: lon.toString(),
    current: "temperature_2m,relative_humidity_2m,weather_code",
    daily: "uv_index_max",
    timezone: "Asia/Kolkata",
    forecast_days: "1",
    past_days: daysBack.toString(),
  });

  const res = await fetch(`${OPEN_METEO_BASE}/forecast?${params}`);
  if (!res.ok) return null;

  const data = await res.json();
  return {
    temperature: data.current?.temperature_2m ?? 0,
    humidity: data.current?.relative_humidity_2m ?? 0,
    uvIndex: data.daily?.uv_index_max?.[data.daily.uv_index_max.length - 1] ?? 0,
    description: weatherCodeToDescription(data.current?.weather_code ?? 0),
  };
}

async function fetch3DayAverage(
  lat: number,
  lon: number,
): Promise<WeatherData | null> {
  const params = new URLSearchParams({
    latitude: lat.toString(),
    longitude: lon.toString(),
    daily: "temperature_2m_mean,relative_humidity_2m_mean,uv_index_max",
    timezone: "Asia/Kolkata",
    past_days: "3",
    forecast_days: "0",
  });

  const res = await fetch(`${OPEN_METEO_BASE}/forecast?${params}`);
  if (!res.ok) return null;

  const data = await res.json();
  const temps = data.daily?.temperature_2m_mean ?? [];
  const humidities = data.daily?.relative_humidity_2m_mean ?? [];
  const uvs = data.daily?.uv_index_max ?? [];

  if (temps.length === 0) return null;

  const avg = (arr: number[]) =>
    arr.reduce((a, b) => a + b, 0) / arr.length;

  return {
    temperature: avg(temps),
    humidity: avg(humidities),
    uvIndex: avg(uvs),
    description: "",
  };
}

function evaluateWeatherChange(
  city: string,
  today: WeatherData,
  avg: WeatherData,
): ProactiveAction | null {
  const humidityDelta = today.humidity - avg.humidity;
  const tempDelta = today.temperature - avg.temperature;

  // Humidity spike/drop (>20% change from 3-day average)
  if (Math.abs(humidityDelta) > 20) {
    const direction = humidityDelta > 0 ? "increased" : "dropped";
    return {
      type: "weather_tip",
      referenceId: `weather_${new Date().toISOString().split("T")[0]}`,
      prompt: `Weather in ${city}: humidity ${direction} significantly — now ${Math.round(today.humidity)}% (was averaging ${Math.round(avg.humidity)}%). Temperature is ${Math.round(today.temperature)}°C. Give a brief skincare tip for this humidity change. 1-2 sentences.`,
    };
  }

  // UV very high (≥8)
  if (today.uvIndex >= 8 && avg.uvIndex < 7) {
    return {
      type: "weather_tip",
      referenceId: `weather_${new Date().toISOString().split("T")[0]}`,
      prompt: `UV index in ${city} is very high today (${today.uvIndex}) — previously averaging ${Math.round(avg.uvIndex)}. Give a brief sunscreen/sun protection tip. 1-2 sentences.`,
    };
  }

  // Extreme temperature (>40°C or <10°C)
  if (today.temperature > 40 && avg.temperature <= 38) {
    return {
      type: "weather_tip",
      referenceId: `weather_${new Date().toISOString().split("T")[0]}`,
      prompt: `It's extremely hot in ${city} today (${Math.round(today.temperature)}°C). Give a brief skincare tip for extreme heat — hydration, sunscreen, lightweight products. 1-2 sentences.`,
    };
  }

  if (today.temperature < 10 && avg.temperature >= 12) {
    return {
      type: "weather_tip",
      referenceId: `weather_${new Date().toISOString().split("T")[0]}`,
      prompt: `Temperature dropped significantly in ${city} (${Math.round(today.temperature)}°C, was averaging ${Math.round(avg.temperature)}°C). Give a brief cold weather skincare tip. 1-2 sentences.`,
    };
  }

  // Nothing notable
  return null;
}

function weatherCodeToDescription(code: number): string {
  if (code === 0) return "clear sky";
  if (code <= 3) return "partly cloudy";
  if (code <= 48) return "foggy";
  if (code <= 57) return "drizzle";
  if (code <= 67) return "rain";
  if (code <= 77) return "snow";
  if (code <= 82) return "rain showers";
  if (code <= 86) return "snow showers";
  if (code >= 95) return "thunderstorm";
  return "unknown";
}
