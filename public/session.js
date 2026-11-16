/* Etats serveur et session */
const SERVER_STATE = {DOWN: "Déconnecté", AVAILABLE: "Disponible", AUTHENTICATED: "Authentifié"};
const SESSION_STATE = {NONE: "Aucune session", HOST_WAITING: "Session disponible", GUEST_JOINED: "Invité en attente", SESSION_FOUND: "Session reconnue", DIRECT_READY: "Session directe disponible"};
/* Etat courant */
let serverState = SERVER_STATE.DOWN;
let sessionState = SESSION_STATE.NONE;
let authenticated = false;
let heartbeatInterval = null;
let heartbeatTimer = null;
let peerConnection = null;
let isHost = false;

/* Peer Id persistant */
let peerId = localStorage.getItem("fouy.session.peerId");
if (!peerId) {
    peerId = crypto.randomUUID();
    localStorage.setItem("fouy.session.peerId", peerId);}
/* Gestion des requêtes */
let requestId = 0;
const pendingRequests = new Map();
/* Références DOM */
const logs = document.getElementById("logs");
let indicator;
function createSessionIndicator() {
    if (document.getElementById("sessionIndicator")) {return;}
    const style = document.createElement("style");
    style.id = "sessionIndicatorStyle";
    style.textContent = `#sessionIndicator {position: fixed; top: 10px; right: 10px; width: 24px; height: 24px; border-radius: 50%; z-index: 9999;}
#sessionIndicator.serverDown {border: 5px solid red;}
#sessionIndicator.serverAvailable {border: 5px solid orange;}
#sessionIndicator.serverUp {border: 5px solid green;}
#sessionIndicator.noSession {background-color: red;}
#sessionIndicator.sessionAvailable {background-color: orange;}
#sessionIndicator.sessionRecognized {background-color: yellow;}
#sessionIndicator.sessionDirect {background-color: lightgreen;}`;
    document.head.appendChild(style);
    const indicator = document.createElement("div");
    indicator.id = "sessionIndicator";
    document.body.appendChild(indicator);}

async function createPeerConnection() {
    if (peerConnection) {return;}
    peerConnection = new RTCPeerConnection();
    peerConnection.createDataChannel("fouy");
    peerConnection.onicecandidate = async (event) => {
        if (!event.candidate) {return;}
        await webSocketSend({target: "server", type: "ice-candidate", data: { candidate: event.candidate}});
        log("ICE envoyé");};
    peerConnection.onconnectionstatechange = () => {
        log(`Connection state : ${peerConnection.connectionState}`);
        if (peerConnection.connectionState === "connected") {
            sessionState = SESSION_STATE.DIRECT_READY
            updateIndicator();}};
    log("RTCPeerConnection créée");
    if (isHost) {await createOffer();}}

/* Journalisation */
function log(message) {
    const line = document.createElement("div");
    line.textContent = message;
    logs.appendChild(line);}
/* IDs */
function nextRequestId() {
    requestId++;
    return requestId.toString();}
function startHeartbeat() {
    if (heartbeatTimer) {
        clearInterval(heartbeatTimer);}
    heartbeatTimer = setInterval(async () => {
        try {await webSocketSend({target: "server", type: "heartbeat", data: {}});}
        catch (error) {log(`Heartbeat perdu : ${error.message}`);}}, heartbeatInterval * 1000);}

/* Puce */
function updateIndicator() {
    indicator.className = "";
    switch (serverState) {
        case SERVER_STATE.AUTHENTICATED:
            indicator.classList.add("serverUp");
            break;
        case SERVER_STATE.AVAILABLE:
            indicator.classList.add("serverAvailable");
            break;
        default:
            indicator.classList.add("serverDown");}
    switch (sessionState) {
        case SESSION_STATE.HOST_WAITING:
            indicator.classList.add("sessionAvailable");
            break;
        case SESSION_STATE.GUEST_JOINED:
            indicator.classList.add("sessionRecognized");
            break;
        case SESSION_STATE.SESSION_FOUND:
            indicator.classList.add("sessionRecognized");
            break;
        case SESSION_STATE.DIRECT_READY:
            indicator.classList.add("sessionDirect");
            break;
    default:
        indicator.classList.add("noSession");}
    indicator.title = `${serverState} / ${sessionState}`;}

/* Authentification */
async function authenticate() {
    const apiKey = document.getElementById("apiKey").value;
    const response = await sendRawMessage({target: "server", type: "authenticate", data: {apiKey}});
    if (response.type === "authenticated") {
        authenticated = true;
        serverState = SERVER_STATE.AUTHENTICATED;
        updateIndicator();
        log("Authentification OK");
        return true;}
    throw new Error(response.error || "Authentication failed");}

async function createOffer() {
    const offer = await peerConnection.createOffer();
    await peerConnection.setLocalDescription(offer);
    await webSocketSend({target: "server", type: "offer", data: {offer}});
    log("Offer envoyée");}

/* Envoi brut */
function sendRawMessage(message) {
    return new Promise((resolve, reject) => {
        const id = nextRequestId();
        message.id = id;
        message.peerId = peerId;
        pendingRequests.set(id, {resolve, reject});
        socket.send(JSON.stringify(message));});}

/* API publique */
async function webSocketSend(message) {
    if (!authenticated) { await authenticate();}
    return await sendRawMessage( message);}

/* WebSocket */
let socket;
function connectWebSocket() {
    const protocol = location.protocol === "https:" ? "wss:" : "ws:";
    socket = new WebSocket(`${protocol}//${location.host}`);
    socket.addEventListener("open",() => {
        serverState = SERVER_STATE.AVAILABLE;
        updateIndicator();
        log(`WebSocket connecté (${peerId})`);});

    socket.addEventListener("close",() => {
        authenticated = false;
        serverState = SERVER_STATE.DOWN;
        updateIndicator();
        log("WebSocket déconnecté");});
        socket.addEventListener(
        "message", async (event) => {
            const message = JSON.parse(event.data);
            if (message.type === "connected") {
                heartbeatInterval = message.data.heartbeatInterval;
                startHeartbeat();
                return;}
            if (message.type === "guest-joined") {
                sessionState = SESSION_STATE.GUEST_JOINED;
                log(`Invité connecté : ${message.data.peerId}`);
                updateIndicator();
                createPeerConnection();
                return;}
            if (message.type === "session-joined") {
                sessionState = SESSION_STATE.SESSION_FOUND;
                log(`Session reconnue : ${message.data.sessionId}`);
                updateIndicator();
                createPeerConnection();
                return;}
            if (message.type === "offer") {
                log("Offer reçue");
                await peerConnection.setRemoteDescription(new RTCSessionDescription(message.data.offer));
                const answer = await peerConnection.createAnswer();
                await peerConnection.setLocalDescription(answer);
                await webSocketSend({target: "server", type: "answer", data: {answer}});
                log("Answer envoyée");
                return;}
            if (message.type === "answer") {
                log("Answer reçue");
                await peerConnection.setRemoteDescription(new RTCSessionDescription(message.data.answer));
                return;}
            if (message.type === "ice-candidate") {
                await peerConnection.addIceCandidate(new RTCIceCandidate(message.data.candidate));
                log("ICE reçu");
                return;}
            if (message.type === "heartbeat-ok") {return;}
            if (message.id && pendingRequests.has(message.id)) {
                const request = pendingRequests.get(message.id);
                pendingRequests.delete(message.id);
                request.resolve(message);
                return;}
            log(`Message : ${event.data}`);});}

/* Boutons de test */
document.getElementById("createSession").addEventListener("click", async () => {
    try {
        const response = await webSocketSend({target: "server", type: "create-session", data: {}});
        if (response.type === "session-created") {
            sessionState = SESSION_STATE.HOST_WAITING;
            isHost = true;
            updateIndicator();
            document.getElementById("sessionId").value = response.data.sessionId;
            log(`Session créée : ${response.data.sessionId}`);}}
    catch (error) {log(`Erreur : ${error.message}`);}});

document.getElementById("joinSession").addEventListener("click", async () => {
    try {
        const sessionId = document.getElementById("sessionId").value;
        const response = await webSocketSend({target: "server", type: "join-session", data: {sessionId}});
        if (response.type === "session-joined") {
            sessionState = SESSION_STATE.SESSION_FOUND;
            updateIndicator();}}
    catch (error) {log(`Erreur : ${error.message}`);}});

/* Initialisation */
createSessionIndicator();
indicator = document.getElementById("sessionIndicator");
updateIndicator();
connectWebSocket();