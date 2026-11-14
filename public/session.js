/*
 * Etats serveur
 */

const SERVER_STATE = {
    DOWN: "Déconnecté",
    AVAILABLE: "Disponible",
    AUTHENTICATED: "Authentifié"
};

/*
 * Etats session
 */

const SESSION_STATE = {
    NONE: "Aucune session",
    PENDING: "Session en attente",
    CONNECTED: "Session connectée"
};

/*
 * Etat courant
 */

let serverState = SERVER_STATE.DOWN;
let sessionState = SESSION_STATE.NONE;
let authenticated = false;

/*
 * Gestion des requêtes
 */

let requestId = 0;

const pendingRequests = new Map();

/*
 * Références DOM
 */

const logs = document.getElementById("logs");
const indicator = document.getElementById("sessionIndicator");

/*
 * Journalisation
 */

function log(message) {

    const line = document.createElement("div");

    line.textContent = message;

    logs.appendChild(line);

}

/*
 * Mise à jour de la puce
 */

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
            indicator.classList.add("serverDown");
    }

    switch (sessionState) {

        case SESSION_STATE.CONNECTED:
            indicator.classList.add("sessionUp");
            break;

        case SESSION_STATE.PENDING:
            indicator.classList.add("sessionWaiting");
            break;

        default:
            indicator.classList.add("noSession");
    }

    indicator.title =
        `${serverState} / ${sessionState}`;

}

/*
 * Helpers
 */

function nextRequestId() {

    requestId++;

    return requestId.toString();

}

/*
 * Authentification
 */

function authenticate() {

    return new Promise((resolve, reject) => {

        const apiKey =
            document.getElementById("apiKey").value;

        const id = nextRequestId();

        pendingRequests.set(id, {

            resolve: (message) => {

                authenticated = true;

                serverState =
                    SERVER_STATE.AUTHENTICATED;

                updateIndicator();

                resolve(message);

            },

            reject

        });

        socket.send(JSON.stringify({

            id,
            type: "authenticate",
            apiKey

        }));

    });

}

/*
 * Fonction générique
 */

async function webSocketSend(message) {

    if (!authenticated) {

        await authenticate();

    }

    return new Promise((resolve, reject) => {

        const id = nextRequestId();

        message.id = id;

        pendingRequests.set(
            id,
            {
                resolve,
                reject
            }
        );

        socket.send(
            JSON.stringify(message)
        );

    });

}

/*
 * Connexion WebSocket
 */

let socket;

function connectWebSocket() {

    const protocol =
        location.protocol === "https:"
            ? "wss:"
            : "ws:";

    socket = new WebSocket(
        `${protocol}//${location.host}`
    );

    socket.addEventListener("open", () => {

        serverState =
            SERVER_STATE.AVAILABLE;

        updateIndicator();

        log("WebSocket connecté");

    });

    socket.addEventListener("close", () => {

        authenticated = false;

        serverState =
            SERVER_STATE.DOWN;

        updateIndicator();

        log("WebSocket déconnecté");

    });

    socket.addEventListener("error", () => {

        log("Erreur WebSocket");

    });

    socket.addEventListener("message", (event) => {

        const message =
            JSON.parse(event.data);

        if (
            message.id &&
            pendingRequests.has(message.id)
        ) {

            const request =
                pendingRequests.get(message.id);

            pendingRequests.delete(
                message.id
            );

            request.resolve(message);

            return;

        }

        log(