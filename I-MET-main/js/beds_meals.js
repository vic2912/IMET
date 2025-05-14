// Importation des modules Firebase nécessaires
import { db } from './firebaseConfig.js';
import { collection, query, where, getDocs, orderBy, limit, doc, getDoc } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';

// Variables globales
let currentWeekStart;

// Initialise la semaine au chargement de la page
window.addEventListener('load', () => {
    initializeWeek();
    loadData();

    // Ajouter un code de débogage pour afficher l'ID de l'utilisateur dans la console
    console.log("ID de l'utilisateur en sessionStorage:", sessionStorage.getItem('userId'));
});

// Initialise la semaine courante à partir du jour actuel, avec le début de la semaine fixé au vendredi
function initializeWeek() {
    const today = new Date();
    const dayOfWeek = today.getDay();
    currentWeekStart = new Date(today);

    // Ajustez pour que la semaine commence le vendredi
    // Si aujourd'hui est vendredi (5), samedi (6) ou dimanche (0), ajustez en conséquence
    if (dayOfWeek === 6) { // Samedi
        currentWeekStart.setDate(today.getDate() - 1);
    } else if (dayOfWeek === 0) { // Dimanche
        currentWeekStart.setDate(today.getDate() - 2);
    } else {
        currentWeekStart.setDate(today.getDate() - ((dayOfWeek + 2) % 7));
    }
    updateWeekLabel();
}


// Met à jour l'étiquette de la semaine actuelle
function updateWeekLabel() {
    const weekEnd = new Date(currentWeekStart);
    weekEnd.setDate(currentWeekStart.getDate() + 9); // Fin de la semaine (9 jours plus tard)

    // Formatage des dates pour obtenir "1 - 9 Jan 2024"
    const debutSemaine = formatDateSimple(currentWeekStart); // Exemple: "1 Jan"
    const finSemaine = formatDateSimple(weekEnd); // Exemple: "9 Jan"
    const annee = currentWeekStart.getFullYear(); // Exemple: "2024"

    document.getElementById('currentWeek').textContent = `${debutSemaine} - ${finSemaine} ${annee}`;
}

// Fonction pour formater la date en "1 Jan"
function formatDateSimple(date) {
    const jours = ["Dim", "Lun", "Mar", "Mer", "Jeu", "Ven", "Sam"];
    const mois = ["Jan", "Fév", "Mar", "Avr", "Mai", "Juin", "Juil", "Aoû", "Sep", "Oct", "Nov", "Déc"];
    let jourMois = date.getDate();
    let moisAnnee = mois[date.getMonth()];
    return `${jourMois} ${moisAnnee}`;
}

// Tableau des jours de la semaine en français
const jours = ["Dim", "Lun", "Mar", "Mer", "Jeu", "Ven", "Sam"];

// Modifiez la fonction formatDate pour utiliser le format souhaité
function formatDate(date) {
    let jour = jours[date.getDay()];
    let jourMois = date.getDate();
    return `${jour} ${jourMois}`;
}

// Charge les données depuis Firebase
async function loadData() {
    const usersSnapshot = await getDocs(collection(db, 'Users'));
    const eventsSnapshot = await getDocs(collection(db, 'Events'));
    const users = usersSnapshot.docs.map(doc => doc.data());
    const events = eventsSnapshot.docs.map(doc => doc.data());
    updateTables(users, events);
}

// Met à jour les tableaux de repas et de couchages
function updateTables(users, events) {
    updateBedsTable(events);
    updateMealsTable(events);
}

// Met à jour le tableau des couchages
function updateBedsTable(events) {
    const bedsTable = document.getElementById('bedsTable');
    bedsTable.innerHTML = '';

    // Créez le tableau en deux parties, avec un saut de ligne après le mardi
    createBedsTableHalf(bedsTable, events, 0, 5); // De vendredi à mardi
    bedsTable.appendChild(document.createElement('br')); // Saut de ligne
    createBedsTableHalf(bedsTable, events, 5, 10); // De mercredi à dimanche suivant
}


// Crée une moitié du tableau des couchages
function createBedsTableHalf(bedsTable, events, startDay, endDay, breakAfterTuesday = false) {
    const daysRow = document.createElement('tr');
    const nightsRow = document.createElement('tr');

    for (let i = startDay; i < endDay; i++) {
        const dayDate = new Date(currentWeekStart);
        dayDate.setDate(dayDate.getDate() + i);
        daysRow.appendChild(createDayCell(dayDate, '1'));
        nightsRow.appendChild(createNightCell(dayDate, events));

        if (breakAfterTuesday && i === 2) { // Mardi est le 3ème jour à partir de vendredi
            bedsTable.appendChild(daysRow);
            bedsTable.appendChild(nightsRow);
            bedsTable.appendChild(document.createElement('br')); // Saut de ligne après mardi
            daysRow = document.createElement('tr');
            nightsRow = document.createElement('tr');
        }
    }

    bedsTable.appendChild(daysRow);
    bedsTable.appendChild(nightsRow);
}


// Met à jour le tableau des repas
function updateMealsTable(events) {
    const mealsTable = document.getElementById('mealsTable');
    mealsTable.innerHTML = '';

    // Créez le tableau en deux parties, avec un saut de ligne après le mardi
    createMealsTableHalf(mealsTable, events, 0, 5); // De vendredi à mardi
    mealsTable.appendChild(document.createElement('br')); // Saut de ligne
    createMealsTableHalf(mealsTable, events, 5, 10); // De mercredi à dimanche suivant
}

// Crée une moitié du tableau des repas
function createMealsTableHalf(mealsTable, events, startDay, endDay) {
    const daysRow = document.createElement('tr');
    const mealTypesRow = document.createElement('tr');
    const mealsCountRow = document.createElement('tr');

    for (let i = startDay; i < endDay; i++) {
        const dayDate = new Date(currentWeekStart);
        dayDate.setDate(dayDate.getDate() + i);
        daysRow.appendChild(createDayCell(dayDate, '2'));

        mealTypesRow.appendChild(createMealTypeCell('Déj'));
        mealTypesRow.appendChild(createMealTypeCell('Dîn'));

        mealsCountRow.appendChild(createMealsCountCell(dayDate, events, 'dejeuner'));
        mealsCountRow.appendChild(createMealsCountCell(dayDate, events, 'diner'));
    }

    mealsTable.appendChild(daysRow);
    mealsTable.appendChild(mealTypesRow);
    mealsTable.appendChild(mealsCountRow);
}

// Fonctions auxiliaires pour créer les cellules
function createHeaderCell(text, colspan) {
    const cell = document.createElement('th');
    cell.textContent = text;
    cell.setAttribute('colspan', colspan);
    return cell;
}

function createDayCell(date, colspan) {
    const cell = document.createElement('td');
    cell.textContent = formatDate(date);
    cell.setAttribute('colspan', colspan);
    return cell;
}

function createNightCell(date, events) {
    const cell = document.createElement('td');
    cell.textContent = calculateNightsForDate(date.toISOString().split('T')[0], events);
    return cell;
}

function createMealTypeCell(mealType) {
    const cell = document.createElement('td');
    cell.textContent = mealType;
    return cell;
}

function createMealsCountCell(date, events, mealType) {
    const cell = document.createElement('td');
    cell.textContent = calculateMealsForDate(date.toISOString().split('T')[0], events, mealType);
    return cell;
}

function calculateNightsForDate(dateString, events) {
    const specifiedDate = new Date(dateString);
    // Définir les heures pour le soir et le matin du jour suivant
    const eveningTime = new Date(specifiedDate.getFullYear(), specifiedDate.getMonth(), specifiedDate.getDate(), 23, 30);
    const nextMorningTime = new Date(specifiedDate.getFullYear(), specifiedDate.getMonth(), specifiedDate.getDate() + 1, 7, 30);

    let totalNights = 0;

    events.forEach(event => {
        const eventStartDate = new Date(event.dateDebut);
        const eventEndDate = new Date(event.dateFin);

        // Vérifier si l'événement se déroule pendant la période de nuit spécifiée
        if (eventStartDate <= eveningTime && eventEndDate >= nextMorningTime) {
            totalNights += event.nombreParticipants;
        }
    });

    return totalNights;
}



function calculateMealsForDate(dateString, events, mealType) {
    const specifiedDate = new Date(dateString);
    specifiedDate.setHours(0, 0, 0, 0);
    let totalMeals = 0;

    events.forEach(event => {
        const startDate = new Date(event.dateDebut);
        const endDate = new Date(event.dateFin);

        // Déterminer si l'événement inclut un déjeuner ou un dîner pour cette date
        if (includesMeal(startDate, endDate, specifiedDate, mealType)) {
            totalMeals += event.nombreParticipants;
        }
    });

    return totalMeals;
}

// Fonction auxiliaire pour vérifier si un événement inclut un repas spécifique pour une date donnée
function includesMeal(startDate, endDate, dayDate, mealType) {
    const startHour = (mealType === 'dejeuner') ? 12 : 18;
    const endHour = (mealType === 'dejeuner') ? 14 : 22;

    const mealStartTime = new Date(dayDate.getFullYear(), dayDate.getMonth(), dayDate.getDate(), startHour);
    const mealEndTime = new Date(dayDate.getFullYear(), dayDate.getMonth(), dayDate.getDate(), endHour);

    return (startDate < mealEndTime && endDate > mealStartTime);
}


// Gestionnaires d'événements pour les boutons de navigation des semaines
document.getElementById('prevWeek').addEventListener('click', () => {
    currentWeekStart.setDate(currentWeekStart.getDate() - 7);
    updateWeekLabel();
    loadData();
});

document.getElementById('nextWeek').addEventListener('click', () => {
    currentWeekStart.setDate(currentWeekStart.getDate() + 7);
    updateWeekLabel();
    loadData();
});

const userId = sessionStorage.getItem('userId');

async function fetchUserName(userId) {
    if (!userId) return;

    try {
        const userRef = doc(db, 'Users', userId);
        const userSnap = await getDoc(userRef);

        if (userSnap.exists()) {
            const userData = userSnap.data();
            return userData.Name; // Supposons que le champ pour le nom d'utilisateur est 'Name'
        } else {
            console.log('Utilisateur non trouvé');
            return '';
        }
    } catch (error) {
        console.error('Erreur lors de la récupération des informations de l\'utilisateur:', error);
        return '';
    }
}

window.onload = async function() {
    const userId = sessionStorage.getItem('userId');
    const userName = await fetchUserName(userId);
    document.getElementById('userNameDisplay').textContent = userName;

    // Reste du code...
};

