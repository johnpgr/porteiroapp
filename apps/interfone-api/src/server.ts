import type {
  Express as App,
  Request,
  Response,
  NextFunction,
  ErrorRequestHandler,
} from "express";
import express from "express";
import cors from "cors";
import DatabaseService from "./services/db.service.ts";

// Import routes
import callRoutes from "./routes/call.routes.ts";
import tokenRoutes from "./routes/token.routes.ts";

// Create Express application
const app: App = express();
const PORT = process.env.PORT || 3000;

// CORS middleware
app.use(
  cors({
    origin: [
      "http://localhost:3000",
      "http://localhost:8081",
      "http://localhost:19006",
    ],
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
  }),
);

// JSON parsing middleware
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// Logging middleware
app.use((req: Request, res: Response, next: NextFunction) => {
  const timestamp = new Date().toISOString();
  console.log(`📡 ${timestamp} - ${req.method} ${req.path}`);

  // Log body for POST/PUT requests (except sensitive data)
  if (["POST", "PUT"].includes(req.method) && req.body) {
    const logBody = { ...req.body };
    // Remove sensitive data from log
    if (logBody.password) logBody.password = "[REDACTED]";
    if (logBody.token) logBody.token = "[REDACTED]";
    console.log(`📝 Body:`, logBody);
  }

  next();
});

// Response handling middleware
app.use((req: Request, res: Response, next: NextFunction) => {
  const originalSend = res.send;

  res.send = function (data: any) {
    // Store response data for use in middlewares
    if (typeof data === "string") {
      try {
        (req.body as any).responseData = JSON.parse(data);
      } catch (e) {
        // Ignore if not valid JSON
      }
    } else {
      (req.body as any).responseData = data;
    }

    return originalSend.call(this, data);
  };

  next();
});

// Health check route
app.get("/", (req: Request, res: Response) => {
  res.json({
    success: true,
    message: "Interfone API está funcionando",
    timestamp: new Date().toISOString(),
    version: "1.0.0",
    services: {
      database: "PostgreSQL (Supabase)",
      voiceSDK: "Agora Voice SDK",
      notifications: "Firebase Cloud Messaging",
    },
  });
});

// Service status route
app.get("/api/status", async (req: Request, res: Response) => {
  try {
    // Test database connection
    const dbStatus = await DatabaseService.testConnection();

    // Check Agora configuration
    const agoraConfigured = !!(
      process.env.AGORA_APP_ID && process.env.AGORA_APP_CERTIFICATE
    );

    res.json({
      success: true,
      timestamp: new Date().toISOString(),
      services: {
        database: {
          status: dbStatus ? "connected" : "disconnected",
          type: "PostgreSQL (Supabase)",
        },
        agora: {
          status: agoraConfigured ? "configured" : "not_configured",
          appId: process.env.AGORA_APP_ID ? "set" : "not_set",
        },
        pushNotifications: {
          status: "disabled",
          provider: "Removed - Focus on calls only",
        },
      },
      environment: {
        nodeEnv: process.env.NODE_ENV || "development",
        port: PORT,
      },
    });
  } catch (error) {
    console.error("🔥 Erro ao verificar status dos serviços:", error);
    res.status(500).json({
      success: false,
      error: "Erro ao verificar status dos serviços",
      timestamp: new Date().toISOString(),
    });
  }
});

// Register API routes
app.use("/api/calls", callRoutes);
app.use("/api/tokens", tokenRoutes);

// 404 handler
app.use((req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    error: "Rota não encontrada",
    path: req.originalUrl,
    method: req.method,
    availableRoutes: {
      "GET /": "Health check",
      "GET /api/status": "Status dos serviços",
      "POST /api/calls/start": "Iniciar chamada",
      "POST /api/calls/:callId/answer": "Atender chamada",
      "POST /api/calls/:callId/decline": "Recusar chamada",
      "POST /api/calls/:callId/end": "Encerrar chamada",
      "GET /api/calls/:callId/status": "Status da chamada",
      "GET /api/calls/history": "Histórico de chamadas",
      "GET /api/calls/active": "Chamadas ativas",
      "POST /api/tokens/generate": "Gerar token RTC",
      "POST /api/tokens/generate-multiple": "Gerar múltiplos tokens",
      "POST /api/tokens/validate": "Validar token",
    },
  });
});

// Global error handler
const errorHandler: ErrorRequestHandler = (error, req, res, next) => {
  console.error("🔥 Erro não tratado:", error);

  // Don't expose error details in production
  const isDevelopment = process.env.NODE_ENV !== "production";

  res.status((error as any).status || 500).json({
    success: false,
    error: isDevelopment ? error.message : "Erro interno do servidor",
    timestamp: new Date().toISOString(),
    ...(isDevelopment && { stack: error.stack }),
  });
};

app.use(errorHandler);

// Function to start the server
async function startServer() {
  try {
    console.log("🚀 Iniciando Interfone API...");

    // Test database connection
    console.log("🔍 Testando conexão com banco de dados...");
    const dbConnected = await DatabaseService.testConnection();

    if (dbConnected) {
      console.log("✅ Conexão com banco de dados estabelecida");
    } else {
      console.warn("⚠️ Não foi possível conectar ao banco de dados");
    }

    // Check configuration
    console.log("🔧 Verificando configurações...");

    const agoraConfigured = !!(
      process.env.AGORA_APP_ID && process.env.AGORA_APP_CERTIFICATE
    );
    console.log(
      `📡 Agora SDK: ${agoraConfigured ? "✅ Configurado" : "❌ Não configurado"}`,
    );

    console.log(`📱 Push Notifications: ❌ Removido (foco apenas em chamadas)`);

    // Start server
    const server = app.listen(PORT, () => {
      console.log("🎉 Interfone API iniciada com sucesso!");
      console.log(`📍 Servidor rodando em: http://localhost:${PORT}`);
      console.log(`🌍 Ambiente: ${process.env.NODE_ENV || "development"}`);
      console.log("📋 Rotas disponíveis:");
      console.log("   GET  / - Health check");
      console.log("   GET  /api/status - Status dos serviços");
      console.log("   POST /api/calls/start - Iniciar chamada");
      console.log("   POST /api/calls/:callId/answer - Atender chamada");
      console.log("   POST /api/calls/:callId/decline - Recusar chamada");
      console.log("   POST /api/calls/:callId/end - Encerrar chamada");
      console.log("   GET  /api/calls/:callId/status - Status da chamada");
      console.log("   GET  /api/calls/history - Histórico de chamadas");
      console.log("   GET  /api/calls/active - Chamadas ativas");
      console.log("   POST /api/tokens/generate - Gerar token RTC");
      console.log(
        "   POST /api/tokens/generate-multiple - Gerar múltiplos tokens",
      );
      console.log("   POST /api/tokens/validate - Validar token");
      console.log("");
      console.log("🔗 Para testar: curl http://localhost:" + PORT);
    });

    // Graceful shutdown
    process.on("SIGTERM", () => {
      console.log("📴 Recebido SIGTERM, encerrando servidor...");
      server.close(() => {
        console.log("✅ Servidor encerrado graciosamente");
        process.exit(0);
      });
    });

    process.on("SIGINT", () => {
      console.log("📴 Recebido SIGINT, encerrando servidor...");
      server.close(() => {
        console.log("✅ Servidor encerrado graciosamente");
        process.exit(0);
      });
    });
  } catch (error) {
    console.error("🔥 Erro ao iniciar servidor:", error);
    process.exit(1);
  }
}

// Start server if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  startServer();
}

export default app;
