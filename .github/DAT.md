# DAT – Fouy Session / WebRTC P2P Framework

Version : 6.1 État : Framework fonctionnel validé

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
### Reconnexion WebSocket
WebSocket fermé -> Tentative automatique -> Reconnexion -> Reprise heartbeat

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
"peerName":"Mon PC",
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

### Synchronisation des pairs

- update-peer-name
- peer-name-updated

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
hostPeerName,
 
guest,
guestPeerId,
guestPeerName,
 
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

### Notifications
fouySessionToast(type,message) ["info","warning","error"]

## 10. UI intégrée
Puce : Rouge (hors ligne), Orange (serveur disponible), Verte (authentifié)
Panneau : INFORMATIONS, INVITATION, CONNECTED
Notifications : INFO, WARNING, ERROR

## 11. Évolutions planifiées

### V6.2 ✅
Réassociation automatique de session

Objectif :
retrouver une session après reconnexion WebSocket.

### V6.3
Réparation automatique WebRTC

Objectif :
renégocier Offer / Answer après perte du DataChannel.

### V6.4
Robustesse mobile

Tests :
- Android écran éteint
- Changement Wifi / 4G
- Retour arrière-plan / premier plan

### V7
API applicative

directSend(...)
directReceive(...)
messages métier

## Historique des versions

✅ V5.0 : WebRTC fonctionnel
✅ V5.1 : Jonction URL
✅ V5.2 : QRCode
✅ V5.3 : Guest sans API Key
✅ V5.4 : UI autonome
✅ V5.5 : Machine à états du panneau
✅ V5.6 : Synchronisation peerName
✅ V5.7 : Notifications Toast
✅ V6.1 : Reconnexion WebSocket