# Weather adapter preparation

Status: provider Open-Meteo confirmed; implementation proposed. Backend supplies owned farm scope and consented approximate coordinates. AI weather module performs a fixed-host typed request and normalized DTO; it receives no database access or arbitrary user URL.

Fields: temperature_2m (C), relative_humidity_2m (%), precipitation/rain (mm), weather_code, current/forecast time; preserve units, provider/grid context, fetchedAt and cache age. Official documentation: https://open-meteo.com/en/docs . Current values may be modeled. Backend owns Redis caching and WeatherSnapshot records.

Proposed cache TTL 15 minutes, labelled stale fallback <=60 minutes, bounded timeout/backoff and coordinate+field+units/horizon cache key. Missing consent/location or provider failure returns an unavailable state, never made-up readings. Expert-reviewed qualitative advisories only; no manufactured disease probability. Full plan: `docs/project-planning/WEATHER_INTEGRATION.md`.
