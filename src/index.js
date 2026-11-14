import express from "express";

const app = express();

app.use(express.json());

const PORT = process.env.PORT || 3000;
const API_KEY = process.env.API_KEY;

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

app.get("/", (req, res) => {
    res.json({
        status: "ok",
        message: "Signal server running"
    });
});

app.listen(PORT, () => {
    console.log(`Server listening on port ${PORT}`);
});