/**
 * Weather CONTEXT from Open-Meteo (https://open-meteo.com, CC BY 4.0 data, no key).
 * This is observation/forecast context only — it is never presented as disease risk.
 */
import 'server-only';
import { z } from 'zod';
import { cacheProvider } from '@/server/cache';
import { db } from '@/server/db';

const forecastSchema = z.object({
  timezone: z.string().optional(),
  current: z.object({
    time: z.string(),
    temperature_2m: z.number().nullable().optional(),
    relative_humidity_2m: z.number().nullable().optional(),
    precipitation: z.number().nullable().optional(),
  }),
  hourly: z.object({ time: z.array(z.string()), precipitation: z.array(z.number().nullable()) }),
  daily: z.object({
    time: z.array(z.string()),
    temperature_2m_max: z.array(z.number().nullable()),
    temperature_2m_min: z.array(z.number().nullable()),
    precipitation_sum: z.array(z.number().nullable()),
    precipitation_probability_max: z.array(z.number().nullable()).optional(),
    relative_humidity_2m_mean: z.array(z.number().nullable()).optional(),
  }),
});

export interface WeatherContext {
  provider: 'open-meteo';
  latitude: number;
  longitude: number;
  observedAt: string;
  timezone: string | null;
  temperatureC: number | null;
  humidityPct: number | null;
  precipitationMm: number | null;
  rainLast24hMm: number | null;
  rainLast72hMm: number | null;
  forecast: { date: string; maxC: number | null; minC: number | null; rainMm: number | null; rainChancePct: number | null; humidityPct: number | null }[];
  past: { date: string; maxC: number | null; minC: number | null; rainMm: number | null }[];
}

function round(value: number | null | undefined, digits = 1) {
  return value == null ? null : Math.round(value * 10 ** digits) / 10 ** digits;
}

export async function fetchWeather(latitude: number, longitude: number): Promise<WeatherContext> {
  const lat = round(latitude, 2)!;
  const lon = round(longitude, 2)!;
  const cacheKey = `cropai:weather:${lat}:${lon}`;
  const cached = await cacheProvider.get<WeatherContext>(cacheKey).catch(() => null);
  if (cached) return cached;

  const params = new URLSearchParams({
    latitude: String(lat),
    longitude: String(lon),
    current: 'temperature_2m,relative_humidity_2m,precipitation',
    hourly: 'precipitation',
    daily: 'temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max,relative_humidity_2m_mean',
    past_days: '3',
    forecast_days: '4',
    timezone: 'auto',
  });
  const response = await fetch(`https://api.open-meteo.com/v1/forecast?${params}`, {
    signal: AbortSignal.timeout(6000),
    cache: 'no-store',
  });
  if (!response.ok) throw new Error('WEATHER_UNAVAILABLE');
  const data = forecastSchema.parse(await response.json());

  const nowIndex = data.hourly.time.findIndex((t) => t > data.current.time);
  const upto = nowIndex === -1 ? data.hourly.time.length : nowIndex;
  const sumHours = (hours: number) => {
    const slice = data.hourly.precipitation.slice(Math.max(0, upto - hours), upto);
    return slice.length ? round(slice.reduce<number>((sum, v) => sum + (v ?? 0), 0)) : null;
  };
  const today = data.current.time.slice(0, 10);
  const days = data.daily.time.map((date, i) => ({
    date,
    maxC: round(data.daily.temperature_2m_max[i]),
    minC: round(data.daily.temperature_2m_min[i]),
    rainMm: round(data.daily.precipitation_sum[i]),
    rainChancePct: data.daily.precipitation_probability_max?.[i] ?? null,
    humidityPct: round(data.daily.relative_humidity_2m_mean?.[i] ?? null, 0),
  }));

  const context: WeatherContext = {
    provider: 'open-meteo',
    latitude: lat,
    longitude: lon,
    observedAt: data.current.time,
    timezone: data.timezone ?? null,
    temperatureC: round(data.current.temperature_2m),
    humidityPct: round(data.current.relative_humidity_2m, 0),
    precipitationMm: round(data.current.precipitation),
    rainLast24hMm: sumHours(24),
    rainLast72hMm: sumHours(72),
    forecast: days.filter((d) => d.date >= today),
    past: days.filter((d) => d.date < today).map(({ date, maxC, minC, rainMm }) => ({ date, maxC, minC, rainMm })),
  };
  await cacheProvider.set(cacheKey, context, 1800).catch(() => undefined);
  return context;
}

/** Fetches and persists an observation for a farm; returns null when unavailable. */
export async function recordWeatherForFarm(farm: { id: string; latitude: number | null; longitude: number | null }) {
  if (farm.latitude == null || farm.longitude == null) return null;
  try {
    const weather = await fetchWeather(farm.latitude, farm.longitude);
    const observation = await db.weatherObservation.create({
      data: {
        farmId: farm.id,
        latitude: weather.latitude,
        longitude: weather.longitude,
        provider: weather.provider,
        observedAt: new Date(weather.observedAt + (weather.observedAt.length === 16 ? ':00' : '')),
        temperatureC: weather.temperatureC,
        humidityPct: weather.humidityPct,
        precipitationMm: weather.precipitationMm,
        rainLast24hMm: weather.rainLast24hMm,
        rainLast72hMm: weather.rainLast72hMm,
        forecast: { timezone: weather.timezone, forecast: weather.forecast, past: weather.past },
      },
    });
    return { observation, weather };
  } catch (error) {
    console.warn('[weather] unavailable:', (error as Error).message);
    return null;
  }
}

const geocodeSchema = z.object({
  results: z
    .array(
      z.object({
        name: z.string(),
        latitude: z.number(),
        longitude: z.number(),
        admin1: z.string().optional(),
        admin2: z.string().optional(),
        country_code: z.string().optional(),
      }),
    )
    .optional(),
});

export async function searchPlaces(query: string) {
  const params = new URLSearchParams({ name: query, count: '6', language: 'en', format: 'json', countryCode: 'IN' });
  const response = await fetch(`https://geocoding-api.open-meteo.com/v1/search?${params}`, {
    signal: AbortSignal.timeout(5000),
  });
  if (!response.ok) throw new Error('GEOCODING_UNAVAILABLE');
  const data = geocodeSchema.parse(await response.json());
  return (data.results ?? []).map((r) => ({
    name: r.name,
    district: r.admin2 ?? null,
    state: r.admin1 ?? null,
    latitude: r.latitude,
    longitude: r.longitude,
    label: [r.name, r.admin2, r.admin1].filter(Boolean).join(', '),
  }));
}
