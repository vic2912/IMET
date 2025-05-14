import { db } from './firebaseConfig.js';
import { collection, getDocs, doc, deleteDoc, updateDoc, getDoc } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';

async function deleteEvent(eventId) {
    if (confirm("Confirmez-vous la suppression de cet événement ?")) {
        await deleteDoc(doc(db, 'Events', eventId));
        window.location.reload(); // Recharger la page pour voir les changements
    }
}

async function getUserName(userId) {
    const userRef = doc(db, 'Users', userId);
    const userSnap = await getDoc(userRef);
    if (userSnap.exists()) {
        return userSnap.data().Name;
    } else {
        return 'Inconnu';
    }
}

function formatDateTime(dateTimeStr) {
    const dateTime = new Date(dateTimeStr);
    const day = ('0' + dateTime.getDate()).slice(-2);
    const month = ('0' + (dateTime.getMonth() + 1)).slice(-2);
    const year = dateTime.getFullYear().toString().substr(-2);
    const hours = ('0' + dateTime.getHours()).slice(-2);
    const minutes = ('0' + dateTime.getMinutes()).slice(-2);

    return `${day}/${month}/${year} - ${hours}:${minutes}`;
}

async function loadEvents() {
    const eventsTableBody = document.getElementById('eventsTable').getElementsByTagName('tbody')[0];
    const eventsCol = collection(db, 'Events');
    const eventSnapshot = await getDocs(eventsCol);

    for (const doc of eventSnapshot.docs) {
        const event = doc.data();
        const row = eventsTableBody.insertRow();

        // Préparer le texte pour les participants
        let participantText = await prepareParticipantText(event.participants, event.nombreParticipants);

        row.insertCell(0).textContent = doc.id;
        row.insertCell(1).textContent = formatDateTime(event.dateDebut);
        row.insertCell(2).textContent = formatDateTime(event.dateFin);
        row.insertCell(3).textContent = participantText;

        const actionsCell = row.insertCell(4);
        const deleteButton = document.createElement('button');
        deleteButton.textContent = 'Supprimer';
        deleteButton.onclick = () => deleteEvent(doc.id);
        actionsCell.appendChild(deleteButton);
    }
}

async function prepareParticipantText(participants, nombreParticipants) {
    if (participants.includes("UsIflgeZTlY14aHVx6uN")) { // ID du profil "convive"
        return `Convives(${nombreParticipants})`;
    } else {
        const participantNames = await Promise.all(participants.map(userId => getUserName(userId)));
        return participantNames.join(', ');
    }
}

// Chargez les événements lors du chargement de la page
window.onload = () => {
    loadEvents();
};
