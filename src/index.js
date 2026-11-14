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

const server = createServer(app);

const wss = new WebSocketServer({ server });

wss.on("connection", (ws) => {

    ws.isAuthenticated = false;
    ws.peerId = null;

    console.log("Client WebSocket connecté");

    ws.send(JSON.stringify({
        type: "connected"
    }));

    ws.on("message", (rawMessage) => {

        const request = JSON.parse(rawMessage);

        /*
         * Authentification
         */

        if (request.type === "authenticate") {

            if (
                request.data?.apiKey === API_KEY
            ) {

                ws.isAuthenticated = true;
                ws.peerId = request.peerId;

                ws.send(JSON.stringify({
                    id: request.id,
                    type: "authenticated"
                }));

            } else {

                ws.send(JSON.stringify({
                    id: request.id,
                    type: "error",
                    error: "Invalid API key"
                }));

            }

            return;
        }

        /*
         * Tout le reste nécessite
         * une authentification
         */

        if (!ws.isAuthenticated) {

            ws.send(JSON.stringify({
                id: request.id,
                type: "error",
                error: "Not authenticated"
            }));

            return;

        }

        /*
         * Ping
         */

        if (request.type === "ping") {

            ws.send(JSON.stringify({
                id: request.id,
                type: "pong"
            }));

            return;

        }

    });

    ws.on("close", () => {

        console.log(
            `Client déconnecté : ${ws.peerId}`
        );

    });

});

server.listen(PORT, () => {

    console.log(
        `Server listening on port ${PORT}`
    );

});