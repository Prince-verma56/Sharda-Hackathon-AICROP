/**
 * Crop disease diagnosis (AgriSmart India v1 via the private FastAPI service).
 *
 * Server-only entry point for route handlers and, later, LangGraph tools and Vapi
 * function handlers. Browser code should import types from './schemas' only.
 */
export * from './client';
export type * from './schemas';
