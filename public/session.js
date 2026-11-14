const logs = document.getElementById("logs");

function log(message) {

    const line = document.createElement("div");

    line.textContent = message;

    logs.appendChild(line);
}

document
    .getElementById("createSession")
    .addEventListener("click", () => {

        log("Création de session demandée");

    });