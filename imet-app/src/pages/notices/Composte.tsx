// src/pages/notices/Composte.tsx
import React from 'react';
import { defineNotice } from './defineNotice';
import { Yard } from '@mui/icons-material';
import HousePageLayout from '../HousePageLayout';

export const notice = defineNotice({
  title: 'Le compost',
  path: '/maison/composte',
  order: 10,
  icon: Yard,
});

export default function Composte() {
  return (
    <HousePageLayout title="Le compost" coverSrc="/maison/composte/composteur.webp">
      <div style={{ maxWidth: '800px', margin: '0 auto', padding: '16px' }}>

        <section style={{ marginBottom: '24px' }}>
          <h3>1. Déchets de cuisine à composter</h3>
          <ul style={{ lineHeight: '1.6' }}>
            <li><strong>Épluchures</strong> de fruits et légumes</li>
            <li><strong>Restes</strong> de fruits et légumes (viandes et poissons acceptés)</li>
            <li><strong>Marc de café</strong> et sachets de thé (sans agrafe)</li>
            <li><strong>Coquilles d’œufs</strong> broyées</li>
            <li><strong>Tous les restes alimentaires</strong> </li>
          </ul>
        </section>

        <section style={{ marginBottom: '24px' }}>
          <h3>2. Déchets de cuisine à éviter</h3>
          <ul style={{ lineHeight: '1.6' }}>
            <li><strong>Oignons et ails</strong> (tuent les vers de terre)</li>
            <li><strong>Huiles et graisses</strong> (ralentissent la décomposition)</li>
            <li><strong>Épluchures d’agrumes</strong> (en excès, acidifient le compost)</li>
          </ul>
        </section>

        <section style={{ marginBottom: '24px' }}>
          <h3>3. Autres déchets (jardin, maison)</h3>
          <ul style={{ lineHeight: '1.6' }}>
            <li><strong>Tontes de gazon</strong> (en couche fine, bien mélangées)</li>
            <li><strong>Feuilles mortes</strong> et petites branches broyées</li>
            <li><strong>Carton non imprimé</strong> et papier essuie-tout (déchirés)</li>
            <li><strong>Cendres de bois</strong> (en petite quantité, sans gros morceaux)</li>
          </ul>
        </section>

        <section style={{ marginBottom: '24px' }}>
          <h3>4. Gestion des déchets verts en excès</h3>
          <p>
            S'il y a trop de déchets verts :'
          </p>
          <ul style={{ lineHeight: '1.6' }}>
            <li>Les ajouter au <strong>tas derrière le composteur</strong> pour qu’ils se décomposent à l’air libre.</li>
            <li>Les déposer directement <strong> dans le bas du bois des scouts</strong> </li>
          </ul>
        </section>

        <section style={{ marginBottom: '24px' }}>
          <h3>5. Humidité du compost</h3>
          <p>
            Le compost doit être humide comme une éponge essorée.
          </p>
          <ul style={{ lineHeight: '1.6' }}>
            <li><strong>Trop humide ?</strong> Ajoutez des matières sèches (feuilles, carton) et retournez le tas.</li>
            <li><strong>Trop sec ?</strong> Arrosez avec l'arrosoir.</li>
          </ul>
        </section>
      </div>
    </HousePageLayout>
  );
}
