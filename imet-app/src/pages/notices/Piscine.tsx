// src/pages/notices/Piscine.tsx
import { defineNotice } from './defineNotice';
import { Pool, ArrowUpward } from '@mui/icons-material';
import HousePageLayout from '../HousePageLayout';
import { Box, Button, Stack, Fab } from '@mui/material';

export const notice = defineNotice({
  title: 'La piscine',
  path: '/maison/piscine',
  order: 20,
  icon: Pool,
});

export default function Piscine() {
  const sections = [
    { id: 'entretien', label: 'Entretien hebdo' },
    { id: 'ph',        label: 'Réglage du pH' },
    { id: 'hivernage', label: 'Hivernage' },
    { id: 'demarrage', label: 'Remise en route' },
  ];

  const scrollTo = (id: string) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <HousePageLayout
      title="La piscine"
      coverSrc="/maison/piscine/piscine_cover.webp"
      subtitle="Entretien courant, réglage du pH, hivernage et remise en route."
      backTo="/dashboard"
    >
      {/* Mini-nav collante */}
      <Box
        sx={{
          position: 'sticky',
          top: 0,
          zIndex: 2,
          bgcolor: 'background.paper',
          border: '1px solid',
          borderColor: 'divider',
          borderRadius: 2,
          p: 1,
          mb: 2,
        }}
      >
        <Stack direction="row" spacing={1} flexWrap="wrap">
          {sections.map(s => (
            <Button key={s.id} size="small" variant="outlined" onClick={() => scrollTo(s.id)}>
              {s.label}
            </Button>
          ))}
        </Stack>
      </Box>

      {/* ========== Entretien hebdomadaire ========== */}
      <Box id="entretien" sx={{ scrollMarginTop: 80 }}>
        <h2>Entretien hebdomadaire</h2>
        <ol>
          <li>Couper le courant (disjoncteur gris uniquement).</li>
            <Box sx={{ my: 1.5, borderRadius: 2, overflow: 'hidden', maxWidth: 200, mx: 'auto' }}>
            <img src="/maison/Disjoncteur.png" alt="Disjoncteur" loading="lazy" />
            </Box>
            <Box sx={{ my: 1.5, borderRadius: 2, overflow: 'hidden', maxWidth: 200, mx: 'auto' }}>
            <img src="/maison/Bac_noir.png" alt="Bac noir" loading="lazy" />
            </Box>
            <li>Fermez la vanne bleue en amont du bac noir</li>
            <li>Dévissez les deux vis noires, et nettoyez le panier blanc, puis refermez</li>
            <li>Ré-ouvrez la vanne bleue en amont du bac noir</li>

            <Box sx={{ my: 1.5, borderRadius: 2, overflow: 'hidden', maxWidth: 300, mx: 'auto' }}>
            <img src="/maison/pool_filter.png" alt="Filtre à sable" loading="lazy" />
            </Box>  
          <li>Mettre la vanne du filtre en position <em>Nettoyage</em> pendant 2 min. Rallumez le disjoncteur</li>
          <li>Eteignez le disjoncteur, position <em>Rinçage</em> pendant 30 s. Rallumez</li>
          <li>Eteignez, Remettre en position <em>Filtration</em>. Rallumez !</li>
        </ol>

        <div className="callout">
          Si la pompe se désamorce (on entend au bruit que l’eau ne remonte plus), ajoutez de l’eau avec le sceau dans le bac noir.
        </div>
      </Box>

      {/* ========== Le panneau d'affichage ========== */}
      <Box id="ph" sx={{ scrollMarginTop: 80 }}>
        <h2>L'électrolyse</h2>
        <p>
          Chloration: 100% : indique le bon fonctionnement. Une chloration inférieur indique un manque de sel dans l'eau. 
        </p>
        <p>
          PH / SET : le PH s'aligne progressivement avec le SET.  
        </p>
        <Box sx={{ my: 1.5, borderRadius: 2, overflow: 'hidden', maxWidth: 400, mx: 'auto' }}>
          <img src="/maison/Electrolyse.png" alt="Panneau de pilotage pH" loading="lazy" />
        </Box>

        <ul>
          <li>Si pH &lt; 7 : ajouter du pH+ (≈ 1 kg pour +0,1 de pH, à ajuster selon le volume du bassin).</li>
          <li>Couper l’électrolyse pendant 24–36 h après ajout.</li>
          <li>Si pH &gt; 7.4 : vérifier le bidon de pH− (niveau, tuyau, réglage d’injection).</li>
            <Box sx={{ my: 1.5, borderRadius: 2, overflow: 'hidden', maxWidth: 300, mx: 'auto' }}>
            <img src="/maison/PH_Moins.png" alt="Bidon de PH-" loading="lazy" />
            </Box>           
        </ul>
      </Box>

      {/* ========== La filtration ========== */}
      <Box id="ph" sx={{ scrollMarginTop: 80 }}>
        <h2>La filtration</h2>
        <p>
          Vérifiez que l'eau remonte bien dans le bac transparent. Si ce n'est pas plein, fermez la vanne à fond, puis remettez la en position 
        </p>
        <Box sx={{ my: 1.5, borderRadius: 2, overflow: 'hidden', maxWidth: 750, mx: 'auto' }}>
          <img src="/maison/Schema.png" alt="Panneau de pilotage pH" loading="lazy" />
        </Box>
      </Box>


      
      {/* ========== Hivernage ========== */}
      <Box id="hivernage" sx={{ scrollMarginTop: 80 }}>
        <h2>Mise en hivernage</h2>
        <ol>
          <li>Nettoyer la pompe et le préfiltre.</li>
          <li>Vidanger l’installation (purges / bouchons).</li>
          <li>Placer la vanne multi-voies en position <em>Hivernage</em>.</li>
          <li>Couper le courant. Les deux disjoncteurs dans la cabane.</li>
          <li>Fermer les vannes.</li>
          <li>Retirer la sonde, placez là dans son rangement avec de l’eau, mettez le bouchon à l’emplacement de la sonde, et remontez la sonde dans la maison. 
          </li>
        </ol>

      </Box>

      {/* ========== Remise en route ========== */}
      <Box id="demarrage" sx={{ scrollMarginTop: 80 }}>
        <h2>Remise en route</h2>
        <p>Pour remplir la piscine, le robinet se trouve dans le hangar, à côté de la bonbonne noire.  </p>        
        <Box sx={{ my: 1.5, borderRadius: 2, overflow: 'hidden', maxWidth: 760, mx: 'auto' }}>
          <img src="/maison/Valves.png" alt="Vannes de la piscine" loading="lazy" />
        </Box>
        <div className="callout">
          Ne pas allumer l'eau à fond. Sinon les maisons n'ont plus d'eau. Lancez l'eau le plus doucement possible. 
        </div>

        <h3>
        Remise en route de la pompe et de l’électrolyse :
        </h3>
        <ol>
          <li>Vérifier que toutes les vannes sont fermées.</li>
          <li>Calibrer la sonde pH si nécessaire.</li>
          <li>Remettre la sonde en place (attention à ne pas tordre le fil de la sonde lors de l’installation, celui-ci est fragile).</li>
          <li>Ouvrir progressivement les vannes.</li>
          <li>Remplir le bac noir avec de l’eau de la piscine si besoin (amorçage).</li>
          <li>Relancer la filtration.</li>
        </ol>


      </Box>

      {/* Bouton remonter en haut */}
      <Fab
        size="small"
        color="default"
        onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
        sx={{ position: 'fixed', right: 16, bottom: 16, zIndex: 10 }}
        aria-label="Remonter"
      >
        <ArrowUpward />
      </Fab>
    </HousePageLayout>
  );
}
