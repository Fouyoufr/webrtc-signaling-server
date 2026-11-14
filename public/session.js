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

    indicator.classList.add(
        serverState === SERVER_STATE.UP
            ? "serverUp"
            : "serverDown"
    );

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
 * Connexion WebSocket
 */
let socket;
function connectWebSocket() {

    const protocol =
        location.protocol === "https:"
            ? "wss:"
            : "ws:";

    socket =
        new WebSocket(
            `${protocol}//${location.host}`
        );

    socket.addEventListener("open", () => {

        serverState = SERVER_STATE.AVAILABLE;

        updateIndicator();

        log("WebSocket connecté");

    });

    socket.addEventListener("close", () => {

        serverState = SERVER_STATE.DOWN;

        updateIndicator();

        log("WebSocket déconnecté");

    });

    socket.addEventListener("error", () => {

        log("Erreur WebSocket");

    });

    socket.addEventListener("message", (event) => {

        const message =
    JSON.parse(event.data);

if (message.type === "authenticated") {

    authenticated = true;

    serverState =
        SERVER_STATE.AUTHENTICATED;

    updateIndicator();

    log("Authentification OK");

    return;
}

if (message.type === "authentication-failed") {

    log("Authentification refusée");

    return;
}

log(`Message : ${event.data}`);

    });

}

function authenticate() {

    const apiKey =
        document.getElementById("apiKey").value;

    socket.send(
        JSON.stringify({
            type: "authenticate",
            apiKey
        })
    );
}

/*
 * Bouton de test
 */

document
    .getElementById("createSession")
    .addEventListener("click", () => {

        authenticate();

    });

/*
 * Initialisation
 */

updateIndicator();

connectWebSocket();