/**
 * Re-exports the unified AppLogger for backward compatibility.
 * All application logging should go through this module.
 */
export { AppLogger, logger, type LogMetadata } from "../observability/logger";
