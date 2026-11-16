import express from "express";
import { createServer } from "http";
import { WebSocketServer } from "ws";

const app = express();

app.use(express.json());
app.use(express.static("public"));

const PORT = process.env.PORT || 3000;
const API_KEY = process.env.API_KEY;
const HEARTBEAT_INTERVAL = parseInt(process.env.HEARTBEAT_INTERVAL || "30", 10 );
const clients = new Map();

if (!API_KEY) {

    console.error("API_KEY environment variable is missing");

    process.exit(1);

}

const server = createServer(app);

const wss = new WebSocketServer({ server });

const sessions = new Map();

function createSessionId() {

    return Math.random()
        .toString(36)
        .substring(2, 8)
        .toUpperCase();

}

wss.on("connection", (ws) => {
    ws.isAuthenticated = false;
    ws.peerId = null;
    console.log("Client WebSocket connecté");
    ws.send(JSON.stringify({type: "connected", data: {heartbeatInterval: HEARTBEAT_INTERVAL}}));
    ws.on("message", (rawMessage) => {
        const request = JSON.parse(rawMessage);
        /* Authentification */
        if (request.type === "authenticate") {
            if (request.data?.apiKey === API_KEY) {
                ws.isAuthenticated = true;
                ws.peerId = request.peerId;
                clients.set( ws.peerId, ws);
                console.log( `Authentifié : ${ws.peerId}`);
                console.log( `Clients connectés : ${clients.size}`);
                ws.send(JSON.stringify({id: request.id, type: "authenticated"}));} 
            else {ws.send(JSON.stringify({id: request.id, type: "error", error: "Invalid API key"}));}
            return;}

        /* Tout le reste nécessite une authentification */
        if (!ws.isAuthenticated) {
            ws.send(JSON.stringify({ id: request.id, type: "error", error: "Not authenticated"}));
            return;}

        /* Ping et HeratBeat*/
        if (request.type === "ping") {
            ws.send(JSON.stringify({id: request.id, type: "pong"}));
            return;}
        if (request.type === "heartbeat") {
            ws.send(JSON.stringify({id: request.id, type: "heartbeat-ok"}));
            return;}

        /* Création de la session */
        if (request.type === "create-session") {
            const sessionId = createSessionId();
            sessions.set(sessionId, {host: ws, hostPeerId: ws.peerId, guest: null, createdAt: Date.now()});
            console.log(`Session créée : ${sessionId} (${ws.peerId})`);
            ws.send(JSON.stringify({id: request.id, type: "session-created", data: {sessionId}}));
            return;}
            
        /* Rejoindre une session */
        if (request.type === "join-session") {
            const session = sessions.get(request.data.sessionId);
            if (!session) {
                ws.send(JSON.stringify({id: request.id, type: "error", error: "Session not found"}));
                return;}
            session.guest = ws;
            session.guestPeerId = ws.peerId;
            ws.send(JSON.stringify({id: request.id, type: "session-joined", data: {sessionId: request.data.sessionId}}));
            session.host.send(JSON.stringify({type: "guest-joined", data: {peerId: ws.peerId}}));
            return;}
    })

    /* Déconnexion d'un client */
    ws.on("close", () => {
        if (ws.peerId) {clients.delete(ws.peerId);}
        console.log(`Client déconnecté : ${ws.peerId}`);
        console.log(`Clients connectés : ${clients.size}`);});

server.listen(PORT, () => {
    console.log(`Server listening on port ${PORT}`);});
})