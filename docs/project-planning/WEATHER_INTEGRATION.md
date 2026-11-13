# Weather and recommendation integration

Status: Open-Meteo initial provider confirmed; adapter/cache/advisory design proposed. No trained Indian weather-disease outbreak model exists in this project.

Inputs: approximate consented farm coordinates or user-chosen locality, crop and optional growth stage. Retrieve current temperature_2m, relative_humidity_2m, precipitation/rain, weather_code and time; hourly forecast for the next relevant period. Preserve provider units, observation/model-valid times, fetch time, timezone and grid precision. "Current" API values may be modeled estimates, not a sensor on the farm. Official field definitions: https://open-meteo.com/en/docs .

Proposed backend flow: owned farm -> minimal location -> `ai/services/weather` adapter -> fixed Open-Meteo HTTPS host -> timeout/schema validation -> normalized values -> Redis cache -> WeatherSnapshot. Agent receives only an authorized DTO and optional approved weather rule result. Never accept an arbitrary provider URL from the model/user. Coordinates optional; unavailable location yields a clear location-needed response without blocking photo diagnosis.

Proposed cache: rounded consented grid locality + units + field set + forecast horizon, 15-minute fresh TTL, stale up to 60 minutes only when explicitly labelled. Do not key solely by user-provided farm ID without ownership checks; avoid logging exact coordinates. Bound provider concurrency, use backoff, respect terms/attribution and verify whether the intended hackathon/production use fits the provider plan before rollout. Never invent readings on a timeout.

Initial recommendations: weather context and agronomist-approved, disease-specific qualitative rules only. Each rule stores crop/region/stage, source, version, input window, rationale, approval, review date and whether missing inputs invalidate it. No numerical disease probability is computed from generic humidity/rain thresholds. Forecast suitability is not disease presence and cannot justify chemical treatment by itself.

Approved guidance retrieval uses crop/condition/locale/region/effective date. An expert validates source and applicability; native speaker reviews speech/text. GenAI may explain approved facts but cannot invent pesticide names/doses/timing. Unapproved, expired or missing guidance returns no treatment and an expert path. Upstream advice and treatment matchers stay excluded.

Future outbreak modelling: obtain consented, dated, expert/lab-verified disease/outbreak labels linked to crop/variety/stage, locality, management, weather history and prediction horizon; define licensing/representativeness; split by time/location/farm to avoid leakage; compare simple baselines, evaluate calibration/false alarms/missed outbreaks and review agronomic harm before a pilot. This is a research plan, not an existing model or promised accuracy.
