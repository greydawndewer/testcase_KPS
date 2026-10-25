const express = require("express");
const setupHealthEndpoints = require("./health-endpoints");

function createViteHealthPlugin() {
  const status = {
    state: "idle",
    errors: [],
    warnings: [],
    lastCompileTime: null,
    lastSuccessTime: null,
    compileDuration: 0,
    totalCompiles: 0,
    firstCompileTime: null,
  };

  const healthStatus = {
    getStatus() {
      return {
        ...status,
        isHealthy: status.state === "success",
        errorCount: status.errors.length,
        warningCount: status.warnings.length,
        hasCompiled: status.totalCompiles > 0,
      };
    },
    getSimpleStatus() {
      return {
        state: status.state,
        isHealthy: status.state === "success",
        errorCount: status.errors.length,
        warningCount: status.warnings.length,
      };
    },
    beginRequest() {
      const now = Date.now();
      status.state = "compiling";
      status.lastCompileTime = now;
      status.firstCompileTime ??= now;
      return now;
    },
    finishRequest(statusCode, duration) {
      status.totalCompiles += 1;
      status.compileDuration = duration;

      if (statusCode >= 500) {
        status.state = "failed";
        status.errors = [
          { message: `Vite returned HTTP ${statusCode} for a source module` },
        ];
        return;
      }

      status.state = "success";
      status.lastSuccessTime = Date.now();
      status.errors = [];
    },
  };

  return {
    name: "ssms-health-check",
    configureServer(server) {
      const app = express();
      setupHealthEndpoints({ app }, healthStatus);
      app.use((_request, _response, next) => next());
      server.middlewares.use(app);

      const startedAt = healthStatus.beginRequest();
      healthStatus.finishRequest(200, Date.now() - startedAt);
      server.middlewares.use((request, response, next) => {
        if (!request.url?.startsWith("/src/")) {
          return next();
        }

        const startedAt = healthStatus.beginRequest();
        response.once("finish", () => {
          healthStatus.finishRequest(response.statusCode, Date.now() - startedAt);
        });
        next();
      });
    },
  };
}

module.exports = createViteHealthPlugin;
