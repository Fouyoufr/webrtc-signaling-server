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
 * Peer Id persistant
 */

let peerId =
    localStorage.getItem("fouy.session.peerId");

if (!peerId) {

    peerId = crypto.randomUUID();

    localStorage.setItem(
        "fouy.session.peerId",
        peerId
    );

}

/*
 * Gestion des requêtes
 */

let requestId = 0;

const pendingRequests =
    new Map();

/*
 * Références DOM
 */

const logs =
    document.getElementById("logs");

const indicator =
    document.getElementById(
        "sessionIndicator"
    );

/*
 * Journalisation
 */

function log(message) {

    const line =
        document.createElement("div");

    line.textContent = message;

    logs.appendChild(line);

}

/*
 * IDs
 */

function nextRequestId() {

    requestId++;

    return requestId.toString();

}

/*
 * Puce
 */

function updateIndicator() {

    indicator.className = "";

    switch (serverState) {

        case SERVER_STATE.AUTHENTICATED:

            indicator.classList.add(
                "serverUp"
            );

            break;

        case SERVER_STATE.AVAILABLE:

            indicator.classList.add(
                "serverAvailable"
            );

            break;

        default:

            indicator.classList.add(
                "serverDown"
            );

    }

    switch (sessionState) {

        case SESSION_STATE.CONNECTED:

            indicator.classList.add(
                "sessionUp"
            );

            break;

        case SESSION_STATE.PENDING:

            indicator.classList.add(
                "sessionWaiting"
            );

            break;

        default:

            indicator.classList.add(
                "noSession"
            );

    }

    indicator.title =
        `${serverState} / ${sessionState}`;

}

/*
 * Authentification
 */

async function authenticate() {

    const apiKey =
        document.getElementById(
            "apiKey"
        ).value;

    const response =
        await sendRawMessage({

            target: "server",

            type: "authenticate",

            data: {
                apiKey
            }

        });

    if (
        response.type ===
        "authenticated"
    ) {

        authenticated = true;

        serverState =
            SERVER_STATE.AUTHENTICATED;

        updateIndicator();

        log("Authentification OK");

        return true;

    }

    throw new Error(
        response.error ||
        "Authentication failed"
    );

}

/*
 * Envoi brut
 */

function sendRawMessage(message) {

    return new Promise(
        (resolve, reject) => {

            const id =
                nextRequestId();

            message.id = id;
            message.peerId = peerId;

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

        }
    );

}

/*
 * API publique
 */

async function webSocketSend(
    message
) {

    if (!authenticated) {

        await authenticate();

    }

    return await sendRawMessage(
        message
    );

}

/*
 * WebSocket
 */

let socket;

function connectWebSocket() {

    const protocol =
        location.protocol ===
        "https:"
            ? "wss:"
            : "ws:";

    socket = new WebSocket(
        `${protocol}//${location.host}`
    );

    socket.addEventListener(
        "open",
        () => {

            serverState =
                SERVER_STATE.AVAILABLE;

            updateIndicator();

            log(
                `WebSocket connecté (${peerId})`
            );

        }
    );

    socket.addEventListener(
        "close",
        () => {

            authenticated = false;

            serverState =
                SERVER_STATE.DOWN;

            updateIndicator();

            log(
                "WebSocket déconnecté"
            );

        }
    );

    socket.addEventListener(
        "message",
        (event) => {

            const message =
                JSON.parse(
                    event.data
                );

            if (
                message.id &&
                pendingRequests.has(
                    message.id
                )
            ) {

                const request =
                    pendingRequests.get(
                        message.id
                    );

                pendingRequests.delete(
                    message.id
                );

                request.resolve(
                    message
                );

                return;

            }

            log(
                `Message : ${event.data}`
            );

        }
    );

}

/*
 * Bouton de test
 */

document
.getElementById(
    "createSession"
)
.addEventListener(
    "click",
    async () => {

        try {

            const response =
                await webSocketSend({

                    target: "server",

                    type: "create-session",

                    data: {}

                });

            if (
                response.type ===
                "session-created"
            ) {

                sessionState =
                    SESSION_STATE.PENDING;

                updateIndicator();

                log(
                    `Session créée : ${response.data.sessionId}`
                );

            }

        }
        catch (error) {

            log(
                `Erreur : ${error.message}`
            );

        }

    }
);

/*
 * Initialisation
 */

updateIndicator();

connectWebSocket();