import express from "express";
import { createServer } from "http";
import { WebSocketServer } from "ws";

const app = express();

app.use(express.json());
app.use(express.static("public"));

const PORT = process.env.PORT || 3000;
const API_KEY = process.env.API_KEY;

if (!API_KEY) {

    console.error("API_KEY environment variable is missing");

    process.exit(1);
}

function checkApiKey(req, res, next) {

    const authHeader = req.headers.authorization;

    if (!authHeader) {

        return res.status(401).json({
            error: "Missing Authorization header"
        });
    }

    const token = authHeader.replace("Bearer ", "");

    if (token !== API_KEY) {

        return res.status(403).json({
            error: "Invalid API key"
        });
    }

    next();
}

app.post("/api/session", checkApiKey, (req, res) => {

    res.json({
        status: "ok",
        message: "Authenticated"
    });

});

const server = createServer(app);

const wss = new WebSocketServer({
    server
});

wss.on("connection", (ws) => {

    ws.isAuthenticated = false;

    console.log(
        "Client WebSocket connecté"
    );

    ws.send(JSON.stringify({
        type: "connected"
    }));

    ws.on("message", (message) => {

        const request =
            JSON.parse(message);

        if (
            request.type === "authenticate"
        ) {

            if (
                request.apiKey === API_KEY
            ) {

                ws.isAuthenticated = true;

                ws.send(
                    JSON.stringify({
                        id: request.id,
                        type: "authenticated"
                    })
                );

            }
            else {

                ws.send(
                    JSON.stringify({
                        id: request.id,
                        type: "authentication-failed"
                    })
                );

            }

            return;
        }

        if (
            request.type === "ping"
        ) {

            ws.send(
                JSON.stringify({
                    id: request.id,
                    type: "pong"
                })
            );

            return;
        }

    });

    ws.on("close", () => {

        console.log(
            "Client WebSocket déconnecté"
        );

    });

});

server.listen(PORT, () => {

    console.log(`Server listening on port ${PORT}`);

});