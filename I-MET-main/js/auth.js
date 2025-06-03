// auth.js - Nouveau module d'authentification
import { db } from './firebaseConfig.js';
import { doc, getDoc, updateDoc } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';

// Fonction pour hasher un mot de passe (simple pour votre usage)
async function hashPassword(password) {
    const encoder = new TextEncoder();
    const data = encoder.encode(password);
    const hash = await crypto.subtle.digest('SHA-256', data);
    return Array.from(new Uint8Array(hash))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');
}

// Vérifier les identifiants
export async function loginUser(userId, password) {
    try {
        const userRef = doc(db, 'Users', userId);
        const userSnap = await getDoc(userRef);
        
        if (!userSnap.exists() || userSnap.data().actif !== 'true') {
            return { success: false, error: 'Utilisateur non trouvé ou inactif' };
        }
        
        const userData = userSnap.data();
        
        // Si pas de mot de passe défini, demander d'en créer un
        if (!userData.password) {
            return { success: false, needsPasswordSetup: true, userData };
        }
        
        const hashedPassword = await hashPassword(password);
        
        if (userData.password !== hashedPassword) {
            return { success: false, error: 'Mot de passe incorrect' };
        }
        
        // Mettre à jour la dernière connexion
        await updateDoc(userRef, {
            lastLogin: new Date().toISOString()
        });
        
        // Stocker les infos de session
        localStorage.setItem('userId', userId);
        localStorage.setItem('userName', userData.Name);
        localStorage.setItem('userRole', userData.role || 'user');
        localStorage.setItem('sessionExpiry', new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()); // 24h
        
        return { 
            success: true, 
            user: {
                id: userId,
                name: userData.Name,
                role: userData.role || 'user'
            }
        };
        
    } catch (error) {
        console.error('Erreur de connexion:', error);
        return { success: false, error: 'Erreur de connexion' };
    }
}

// Définir un mot de passe pour un utilisateur
export async function setupPassword(userId, password) {
    try {
        const hashedPassword = await hashPassword(password);
        const userRef = doc(db, 'Users', userId);
        
        await updateDoc(userRef, {
            password: hashedPassword,
            passwordSetAt: new Date().toISOString()
        });
        
        return { success: true };
    } catch (error) {
        console.error('Erreur lors de la définition du mot de passe:', error);
        return { success: false, error: 'Erreur lors de la sauvegarde' };
    }
}

// Vérifier si l'utilisateur est connecté et sa session est valide
export async function checkAuth() {
    const userId = localStorage.getItem('userId');
    const sessionExpiry = localStorage.getItem('sessionExpiry');
    
    if (!userId || !sessionExpiry) {
        return { authenticated: false };
    }
    
    // Vérifier si la session a expiré
    if (new Date() > new Date(sessionExpiry)) {
        logout();
        return { authenticated: false };
    }
    
    try {
        // Vérifier que l'utilisateur existe toujours
        const userRef = doc(db, 'Users', userId);
        const userSnap = await getDoc(userRef);
        
        if (!userSnap.exists() || userSnap.data().actif !== 'true') {
            logout();
            return { authenticated: false };
        }
        
        return { 
            authenticated: true, 
            user: {
                id: userId,
                name: localStorage.getItem('userName'),
                role: localStorage.getItem('userRole')
            }
        };
    } catch (error) {
        console.error('Erreur de vérification d\'authentification:', error);
        logout();
        return { authenticated: false };
    }
}

// Vérifier les permissions admin
export function isAdmin() {
    const userRole = localStorage.getItem('userRole');
    return userRole === 'admin';
}

// Déconnexion
export function logout() {
    localStorage.removeItem('userId');
    localStorage.removeItem('userName');
    localStorage.removeItem('userRole');
    localStorage.removeItem('sessionExpiry');
    window.location.href = '../html/login.html';
}

// Prolonger la session
export function extendSession() {
    const newExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    localStorage.setItem('sessionExpiry', newExpiry);
}
