# DAT – Fouy Session / WebRTC P2P Framework

Version : 1.0 État : Prototype fonctionnel validé

##1. Objet

Le projet vise à fournir un mécanisme simple et réutilisable permettant d'établir une connexion directe entre deux navigateurs via WebRTC.

L'application repose sur :

- un serveur de signalisation léger en Node.js ;
- un protocole WebSocket propriétaire ;
- un DataChannel WebRTC pour les échanges applicatifs.

> Une fois la session WebRTC établie, les échanges ne transitent plus par le serveur.

## 2. Architecture générale

Internet
 
        +-------------+
        | Docker Node |
        |  Signaling  |
        +-------------+
              ^
              |
         WebSocket TLS
              |
     +--------+--------+
     |                 |
     v                 v
 +-------------+ +-------------+
| Host        | | Guest       |
| Browser     | | Browser     |
+-------------+ +-------------+
           \     /
            \   /
             \ /
            WebRTC (DataChannel)

## 3. Responsabilités
### Serveur

- authentifie les clients ;
- crée les sessions ;
- met en relation Host et Guest ;
- transporte Offer / Answer / ICE ;
- ne transporte pas les données applicatives.

> Le serveur n'intervient plus après `Connection state = connected`
 
### Client

- gère l'authentification ;
- gère la signalisation ;
- crée les RTCPeerConnection ;
- maintient le WebSocket ;
- exploite le DataChannel.

## 4. Cycle de vie
### Connexion
Ouverture WebSocket -> Authentification -> Heartbeat
### Création de session
Host : create-session -> session-created -> Session disponible
### Jonction
Guest : join-session -> session-joined
Host : guest-joined
### WebRTC
Offer -> Answer -> ICE -> connecting -> connected
### DataChannel
DataChannel ouvert -> Communication directe

## 5. États de la puce
### Couronne externe
- Rouge : Déconnecté
- Orange : Serveur disponible
- Vert : Authentifié

### Centre
- Rouge : Aucune session
- Orange : Session disponible
- Jaune : Session reconnue
- Jaune : Invité connecté
- Vert clair : Session directe disponible

## 6. Protocole WebSocket

Structure commune :

````JSON
{
"id": "123",
"peerId": "xxxx",
"target": "server",
"type": "xxx",
"data": {}
}
````

### Authentification
- authenticate
- authenticated

### Sessions
- create-session
- session-created
- join-session
- session-joined
- guest-joined

### Signalisation WebRTC
- offer
- answer
- ice-candidate

### Maintenance
- heartbeat
- heartbeat-ok

### Erreurs
```JSON
{
"type":"error",
"error":"..."}
```

## 7. Variables d'environnement
- `API_KEY=xxxx` : Clé de protection du serveur.
- `HEARTBEAT_INTERVAL=30` : Intervalle exprimé en secondes.
- `STUN_SERVER=stun:stun.l.google.com:19302` : Serveur STUN transmis au client.

## 8. Fonctions publiques
### Signalisation : webSocketSend(...)

- authentification automatique ;
- ajout id ;
- ajout peerId ;
- attente réponse ;
- Promise.

### Communication directe (à formaliser) : directSend(...)
- dataChannel.send(...)

## 9. Composants techniques
### peerId
persisté dans `localStorage["fouy.session.peerId"]`
### Session
Stockage serveur `sessions`contient :
````JavaScript
{
host,
hostPeerId,
 
guest,
guestPeerId,
 
createdAt}
````

### Clients

Stockage serveur `clients`contient :
````JavaScript
Map(
peerId,
websocket
)
````

## 10. Évolutions planifiées
### V5.1 : Nettoyage UI
logs → console
notifications visuelles

### V5.2 : Animation activité DataChannel
flash vert sur émission/réception.

### V5.3 : Configuration dynamique STUN.

### V5.4 : Reconnexion automatique WebSocket.

### V5.5 : Réassociation automatique d'une session après reconnexion Android.

### V6

Messages applicatifs métier au-dessus de : directSend(...)
 
État actuel du projet

✅ Authentification

✅ Sessions

✅ Heartbeat

✅ STUN

✅ Offer / Answer

✅ ICE

✅ DataChannel

✅ Communication P2P

✅ Validation LAN ↔ LAN

✅ Validation WiFi ↔ 4G

✅ Persistance malgré perte du WebSocket