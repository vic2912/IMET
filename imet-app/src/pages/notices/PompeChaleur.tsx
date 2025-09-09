// src/pages/notices/PompeChaleur.tsx
import React from 'react';
import { defineNotice } from './defineNotice';
import { AcUnit } from '@mui/icons-material';
import HousePageLayout from '../HousePageLayout';

export const notice = defineNotice({
  title: 'Pompe à chaleur',
  path: '/maison/pompe-chaleur',
  order: 20,
  icon: AcUnit,
});

export default function PompeChaleur() {
  return (
    <HousePageLayout
      title="Pompe à chaleur – Courbe de chauffage/rafraîchissement"
      coverSrc="/maison/pompe-chaleur/pac.webp"
    >
      <div style={{ maxWidth: '800px', margin: '0 auto', padding: '16px' }}>

        <section style={{ marginBottom: '24px' }}>
          <h3>1. Allumé / Eteindre</h3>
          <ul style={{ lineHeight: '1.6' }}>
            <li><strong>Absence</strong> : Lorsque vous fermez la maison, n'éteignez jamais la pompe à chaleur. Elle doit simplement être mise en veille.</li>
            <li><strong>Retour</strong> : Lorsque vous revenez dans la maison, sortez la PAC de la veille, mettez la température à 19° max, puis fermez les chauffage de l'étage le temps que les chauffages du rez de chaussé soient chaud.</li>
            <p>Dans tous les cas, il faut au moins 48h pour que la maison soit chaude en hiver.</p>
          </ul>
        </section>

        <section style={{ marginBottom: '24px' }}>
          <h3>2. Réglages avancés</h3>
          <ul style={{ lineHeight: '1.6' }}>
            <li><strong>Pente</strong> : définit la sensibilité de la PAC aux variations extérieures.</li>
            <li><strong>Parallèle</strong> : ajuste la température de consigne en décalant la courbe vers le haut ou le bas.</li>
            <li>Valeurs usine : <strong>Pente = 0.6</strong>, <strong>Parallèle = 1.2</strong>.</li>
          </ul>
        </section>

        <section style={{ marginBottom: '24px' }}>
          <h4>Exemples</h4>
          <ul style={{ lineHeight: '1.6' }}>
            <li><strong>Pièces trop chaudes en demi-saison</strong> : réduisez la pente.</li>
            <li><strong>Pièces trop froides en demi-saison</strong> : augmentez la pente.</li>
            <li><strong>Pièces trop chaudes en hiver</strong> : réduisez le parallèle.</li>
            <li><strong>Pièces trop froides en hiver</strong> : augmentez le parallèle.</li>
          </ul>
        </section>
      </div>
    </HousePageLayout>
  );
}
