import { db } from './firebaseConfig.js';
import { collection, getDocs, doc, getDoc, updateDoc, addDoc } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';

window.openCreateUserModal = openCreateUserModal;
window.closeModal = closeModal;
window.saveUser = saveUser;

window.onload = async function() {
    const userList = document.getElementById('userList');
    const users = await loadUsers();

    users.forEach(user => {
        const userButton = document.createElement('button');
        userButton.textContent = user.Name;
        userButton.onclick = function() { openEditUserModal(user.id); };
        userList.appendChild(userButton);
    });
};

async function loadUsers() {
    const usersCol = collection(db, 'Users');
    const userSnapshot = await getDocs(usersCol);
    return userSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })).sort((a, b) => a.Name.localeCompare(b.Name));
}

function openEditUserModal(userId) {
    const userForm = document.getElementById('userForm');
    const userModal = document.getElementById('userModal');
    const selectedUserId = document.getElementById('selectedUserId');

    userModal.style.display = 'block';
    selectedUserId.textContent = 'Selected User ID: ' + userId; // Display user ID

    getDoc(doc(db, 'Users', userId)).then(docSnap => {
        if (docSnap.exists()) {
            const userData = docSnap.data();
            userForm.userId.value = docSnap.id;
            userForm.userName.value = userData.Name;
            userForm.userYear.value = userData.Year;
            userForm.userParent.value = userData.Parent;
            userForm.userActive.value = userData.actif;
        }
    });
}

function openCreateUserModal() {
    const userForm = document.getElementById('userForm');
    userForm.userId.value = '';
    userForm.userName.value = '';
    userForm.userYear.value = '';
    userForm.userParent.value = '';
    userForm.userActive.value = 'true';
    document.getElementById('userModal').style.display = 'block';
}

function closeModal() {
    document.getElementById('userModal').style.display = 'none';
}

async function saveUser() {
    const userForm = document.getElementById('userForm');
    const userData = {
        Name: userForm.userName.value,
        Year: parseInt(userForm.userYear.value),
        Parent: userForm.userParent.value,
        actif: userForm.userActive.value
    };

    if (userForm.userId.value) {
        // Update existing user
        await updateDoc(doc(db, 'Users', userForm.userId.value), userData);
    } else {
        // Create new user
        await addDoc(collection(db, 'Users'), userData);
    }

    closeModal();
    window.location.reload(); // Reload to update the user list
}
