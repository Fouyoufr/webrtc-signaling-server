/*
 * Etats serveur
 */

const SERVER_STATE = {
    DOWN: "Déconnecté",
    UP: "Connecté"
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

function connectWebSocket() {

    const protocol =
        location.protocol === "https:"
            ? "wss:"
            : "ws:";

    const socket =
        new WebSocket(
            `${protocol}//${location.host}`
        );

    socket.addEventListener("open", () => {

        serverState = SERVER_STATE.UP;

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

        log(`Message : ${event.data}`);

    });

}

/*
 * Bouton de test
 */

document
    .getElementById("createSession")
    .addEventListener("click", () => {

        log("Création de session demandée");

    });

/*
 * Initialisation
 */

updateIndicator();

connectWebSocket();