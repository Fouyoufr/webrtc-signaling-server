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
    process.exit(1);}

const server = createServer(app);
const wss = new WebSocketServer({ server });
const sessions = new Map();

function findSessionByPeerId(peerId) {
    for (const [sessionId, session] of sessions.entries()) {
        if (session.hostPeerId === peerId || session.guestPeerId === peerId) {return { sessionId, session };}}
    return null;}
function findSessionBySocket(ws) {
    for (const [sessionId, session] of sessions.entries()) {
        if (session.host === ws || session.guest === ws) {return { sessionId, session };}}
    return null;}
function getSessionRole(session, ws) {
    if (session.host === ws) {return "host";}
    if (session.guest === ws) {return "guest";}
    return null;}
function getRemoteSocket(session, ws) {
    return session.host === ws ? session.guest : session.host;}

function createSessionId() {
    return Math.random().toString(36).substring(2, 8).toUpperCase();}

wss.on("connection", (ws) => {
    ws.isAuthenticated = false;
    ws.peerId = null;
    console.log("Client WebSocket connecté");
    ws.send(JSON.stringify({type: "connected", data: {heartbeatInterval: HEARTBEAT_INTERVAL}}));
    ws.on("message", (rawMessage) => {
        const request = JSON.parse(rawMessage);
        console.log('DEBUG',request.type,ws.peerId,ws.isAuthenticated);
        /* Authentification */
        if (request.type === "authenticate") {
            if (request.data?.apiKey === API_KEY) {
                ws.isAuthenticated = true;
                ws.peerId = request.peerId;
                ws.peerName = request.peerName;
                clients.set( ws.peerId, ws);
                console.log( `Authentifié : ${ws.peerId}`);
                console.log( `Clients connectés : ${clients.size}`);
                ws.send(JSON.stringify({id: request.id, type: "authenticated"}));
                /*reconnexion automatique
                const result = findSessionByPeerId(ws.peerId);
                if (result) {
                    const { sessionId, session } = result;
                    let role = null;
                    let remotePeerName = null;
                    if (session.hostPeerId === ws.peerId) {
                        role = "host";
                        session.host = ws;
                        remotePeerName = session.guestPeerName;}
                    else {
                        role = "guest";
                        session.guest = ws;
                        remotePeerName = session.hostPeerName;}
                    console.log("Session retrouvée :", sessionId, role);
                    ws.send(JSON.stringify({type: "session-resumed", data: {sessionId, role, remotePeerName}}));} */

                }
            else {ws.send(JSON.stringify({id: request.id, type: "error", error: "Invalid API key"}));}
            return;}

        /* Rejoindre une session */
        if (request.type === "join-session") {
            const session = sessions.get(request.data.sessionId);
            if (!session) {
                ws.send(JSON.stringify({id: request.id, type: "error", error: "Session not found"}));
                return;}
            if (session.guestPeerId && session.guestPeerId !== request.peerId) {
                ws.send(JSON.stringify({id: request.id, type: "error", error: "Invité non autorisé"}));
                return;}
            session.guest = ws;
            session.guestPeerId = request.peerId;
            session.guestPeerName = request.peerName;
            ws.peerId = request.peerId;
            ws.peerName = request.peerName;
            ws.isAuthenticated = true;
            ws.send(JSON.stringify({id: request.id, type: "session-joined", data: {sessionId: request.data.sessionId,peerName: session.hostPeerName}}));
            session.host.send(JSON.stringify({type: "guest-joined", data: {peerId: ws.peerId,peerName: ws.peerName}}));
            return;}

        /* Tout le reste nécessite une authentification */
        if (!ws.isAuthenticated) {
            ws.send(JSON.stringify({ id: request.id, type: "error", error: "Not authenticated"}));
            return;}            

        /* Restauration de session */
        if (request.type === "restore-session") {
            let session = sessions.get(request.data.sessionId);
            if (session) {
                session.host = ws; session.hostPeerId = ws.peerId; session.hostPeerName = ws.peerName;
                ws.send(JSON.stringify({id: request.id, type: "session-restored"}));
                return;}
            sessions.set(request.data.sessionId, {host: ws, hostPeerId: ws.peerId, hostPeerName: ws.peerName, guest: null, guestPeerId: request.data.guestPeerId, guestPeerName: request.data.guestPeerName, createdAt: Date.now()});
            console.log(`Session restaurée : ${request.data.sessionId}`);
            ws.send(JSON.stringify({id: request.id, type: "session-restored"}));
            return;}

        /* Ping et HeratBeat*/
        if (request.type === "ping") {
            ws.send(JSON.stringify({id: request.id, type: "pong"}));
            return;}
        if (request.type === "heartbeat") {
            ws.send(JSON.stringify({id: request.id, type: "heartbeat-ok"}));
            return;}

        /* Changement du nom affiché */
        if (request.type === "update-peer-name") {
            ws.peerName = request.data.peerName;
            const result = findSessionBySocket(ws);
            if (!result) {return;}
            const { session } = result;
            const role = getSessionRole(session, ws);
            if (role === "host") {session.hostPeerName = ws.peerName;} else {session.guestPeerName = ws.peerName;}
            const destination = getRemoteSocket(session, ws);
            if (!destination) {return;}
            destination.send(JSON.stringify({type: "peer-name-updated", data: {peerName: ws.peerName}}));
            return;}

        /* Création de la session */
        if (request.type === "create-session") {
            const sessionId = createSessionId();
            sessions.set(sessionId, {host: ws, hostPeerId: ws.peerId, hostPeerName: ws.peerName, guest: null, guestPeerId: null, guestPeerName: null, createdAt: Date.now()});
            console.log(`Session créée : ${sessionId} (${ws.peerId})`);
            ws.send(JSON.stringify({id: request.id, type: "session-created", data: {sessionId}}));
            return;}

        /* réception offre */
        if (request.type === "offer") {
            const result = findSessionBySocket(ws);
            if (!result) {
                ws.send(JSON.stringify({id: request.id, type: "error", error: "Session introuvable"}));
                return;}
            const { session } = result;
            if (!session.guest) {
                ws.send(JSON.stringify({id: request.id, type: "error", error: "Invité non connecté"}));
                return;}
            session.guest.send(JSON.stringify({type: "offer", data: {offer: request.data.offer}}));
            ws.send(JSON.stringify({id: request.id, type: "offer-sent"}));
            return;}

        if (request.type === "ice-candidate") {
            const result = findSessionBySocket(ws);
            if (!result) {return;}
            const { session } = result;
            const destination = getRemoteSocket(session, ws);
            if (!destination) {return;}
            destination.send(JSON.stringify({type: "ice-candidate", data: {candidate: request.data.candidate}}));
            return;}

        /* Réponse à l'offre */
        if (request.type === "answer") {
            const result = findSessionBySocket(ws);
            if (!result) {return;}
            const { session } = result;
            const destination = getRemoteSocket(session, ws);
            if (!destination) {return;}
            destination.send(JSON.stringify({type: "answer", data: {answer: request.data.answer}}));
            ws.send(JSON.stringify({id: request.id, type: "answer-sent"}));
            return;}
    })

    /* Déconnexion d'un client */
    ws.on("close", () => {
        if (ws.peerId) {clients.delete(ws.peerId);}
        console.log(`Client déconnecté : ${ws.peerId}`);
        console.log(`Clients connectés : ${clients.size}`);});
})

server.listen(PORT, () => {
    console.log(`Server listening on port ${PORT}`);});