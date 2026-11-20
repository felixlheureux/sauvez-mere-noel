/** Every line of in-game text, in Quebec French. */

export type Speaker =
  | "narrateur"
  | "pere"
  | "mere"
  | "tijos"
  | "mimi"
  | "lutin"
  | "possede"
  | "fouettard"
  | "gerard"
  | "tiguy";

export interface Line {
  speaker: Speaker;
  text: string;
}

export const SPEAKERS: Record<Speaker, { name: string; pitch: number; color: string }> = {
  narrateur: { name: "Narrateur", pitch: 0.9, color: "#8a6cff" },
  pere: { name: "Père Noël", pitch: 0.75, color: "#e2384d" },
  mere: { name: "Mère Noël", pitch: 1.25, color: "#ff6f9a" },
  tijos: { name: "Lutin Ti-Jos", pitch: 1.7, color: "#3dbb7a" },
  mimi: { name: "Lutine Mimi", pitch: 1.9, color: "#2fa7a0" },
  lutin: { name: "Lutin", pitch: 1.8, color: "#3dbb7a" },
  possede: { name: "Lutin possédé", pitch: 0.55, color: "#a3172b" },
  fouettard: { name: "Père Fouettard", pitch: 0.45, color: "#4a2a5e" },
  gerard: { name: "Grand-Lutin Gérard", pitch: 1.1, color: "#c9813f" },
  tiguy: { name: "Ti-Guy", pitch: 0.6, color: "#c0182f" },
};

const l = (speaker: Speaker, text: string): Line => ({ speaker, text });

export const T = {
  endingTitle: "Joyeux Noël!",
  endingBody:
    "Mère Noël est sauvée, le Père Fouettard est vaincu, pis le village retrouve ses couleurs. Merci d'avoir joué!",
  endingCredits: "Crédits",
  title: "Sauvez Mère Noël!",
  tagline: "Un conte de Noël tout mignon. Promis.",
  play: "Jouer",
  continue: "Continuer",
  map: "Carte du monde",
  options: "Options",
  credits: "Crédits",
  resume: "Reprendre",
  restart: "Recommencer le niveau",
  quit: "Retour au menu",
  loading: "Emballage des cadeaux…",
  loadingSteps: [
    "Emballage des cadeaux…",
    "On démêle les lumières…",
    "On réchauffe la tourtière…",
    "On nourrit les rennes…",
    "Tout est prêt!",
  ],
  clickToPlay: "Clique pour jouer",
  paused: "Pause",
  gameOver: "Ayoye!",
  gameOverSub: "Le Père Noël a besoin d'une petite pause…",
  tryAgain: "Réessayer",
  levelComplete: "Niveau terminé!",
  next: "Niveau suivant",
  kills: "Lutins",
  time: "Temps",
  bells: "Cloches",
  candies: "Bonbons",
  tooSmallTitle: "Ce jeu se joue sur un ordi!",
  tooSmallBody:
    "Sauvez Mère Noël! a besoin d'un clavier, d'une souris et d'un écran assez large. Agrandis ta fenêtre ou reviens sur un ordinateur.",
  tooSmallTouch: "Pas de version mobile, désolé! Le Père Noël a besoin d'une vraie souris.",
  comingSoon: "Ce niveau s'en vient bientôt!",
  locked: "Verrouillé",
  newBadge: "Nouveau!",
  controls: "Commandes",
  optConfetti: "Mode confettis",
  optConfettiHint: "Remplace le sang par des confettis.",
  optSensitivity: "Sensibilité de la souris",
  optVolume: "Volume général",
  optMusicVolume: "Volume de la musique",
  optInvert: "Inverser l'axe vertical",
  optMusic: "Musique",
  close: "Fermer",
  newWeapon: "Nouvelle arme!",
  mapUnlocked: "Carte du monde débloquée!",
  hpLow: "Mon doux…",
} as const;

export const CONTROLS = {
  basic: [
    { keys: ["W", "A", "S", "D"], label: "Marcher" },
    { keys: ["Maj"], label: "Courir" },
    { keys: ["Espace"], label: "Sauter (×2 en l'air)" },
    { keys: ["Q"], label: "Esquive" },
    { keys: ["Clic gauche"], label: "Frapper" },
    { keys: ["Souris"], label: "Regarder" },
    { keys: ["Entrée"], label: "Dialogue suivant" },
  ],
  combat: [
    { keys: ["Clic gauche"], label: "Attaquer (arme en main)" },
    { keys: ["Clic droit"], label: "Frapper" },
    { keys: ["F"], label: "Canne tranchante" },
    { keys: ["Clic droit"], label: "Bedaine (en l'air)" },
    { keys: ["1–0", "Molette"], label: "Changer d'arme" },
  ],
} as const;

export const BUFF_TEXT = {
  rage: { title: "Tire sur la neige!", body: "Rage : dégâts x2", short: "Rage" },
  speed: { title: "Chocolat chaud!", body: "Turbo : plus vite, plus haut", short: "Turbo" },
  shield: { title: "Tuque de laine!", body: "Bloque 3 coups", short: "Tuque" },
} as const;

export const WEAPON_NAMES: Record<string, string> = {
  fists: "Les Poings",
  cane: "La Canne en Sucre",
  capgun: "Le Pistolet à Pétards",
  shotgun: "La Grosse Pétoire",
  smg: "La Mitraillette à Bonbons",
  flamer: "Le Lance-Flammes à Sirop",
  launcher: "Le Lance-Boules",
  icicle: "Le Fusil à Glaçons",
  garland: "La Guirlande Électrique",
  crossbow: "L'Arbalète à Cannes",
  gatling: "La Gatling à Jujubes",
  star: "Le Rayon de l'Étoile",
};

export const LEVELS_META = [
  { id: 0, name: "Le Village du Père Noël", short: "Village" },
  { id: 1, name: "La Place du Marché de Noël", short: "Marché" },
  { id: 2, name: "La Forêt de Sapins Hantés", short: "Forêt" },
  { id: 3, name: "Les Glissades de la Mort", short: "Glissades" },
  { id: 4, name: "La Cabane à Sucre", short: "Cabane" },
  { id: 5, name: "La Patinoire Gelée", short: "Patinoire", boss: true },
  { id: 6, name: "Les Toits du Village", short: "Toits" },
  { id: 7, name: "La Fabrique de Jouets", short: "Fabrique" },
  { id: 8, name: "Les Écuries des Rennes", short: "Écuries" },
  { id: 9, name: "La Montagne de Cadeaux", short: "Montagne" },
  { id: 10, name: "Le Village Cauchemar", short: "Cauchemar", boss: true },
] as const;

export const OBJ = {
  findStar: "Trouve l'étoile en haut de la pile de cadeaux",
  bringStar: "Apporte l'étoile au grand sapin",
  grabCrate: "Ramasse la caisse",
  killElves: "Débarrasse-toi des lutins possédés",
  enterChimney: "Entre dans la cheminée",
  openGift: "Ouvre le cadeau de Gérard près du char",
  crossForest: "Traverse la forêt hantée",
  lightLanterns: "Allume la lanterne près du ruisseau",
  reachTree: "Rejoins le vieux sapin mort",
  survivedClearing: "Survis à l'embuscade",
  getSmg: "Ouvre le cadeau près du chalet",
  getCapgun: "Ouvre le cadeau de Gérard",
  jumpInTube: "Saute dans le tube!",
  slide: "Descends la pente!",
  clearBottom: "Nettoie le bas des pentes",
  takeLift: "Monte sur le cercle doré du télésiège",
  rideLift: "Remonte en télésiège (tu peux tirer!)",
  takeLiftBack: "Reprends le télésiège pour remonter",
  climbBack: "Remonte jusqu'au chalet",
  getFlamer: "Ouvre le cadeau au pied du vieil érable",
  crossGrove: "Traverse l'érablière",
  clearYard: "Nettoie la cour de la cabane",
  enterCabane: "Entre dans la cabane à sucre",
  stopFeast: "Interromps le réveillon des lutins",
  evaporator: "Rends-toi à la salle de l'évaporateur",
  exitYard: "Sors par la cheminée dans la cour",
  getLauncher: "Ouvre le cadeau sur la glace",
  crossLake: "Traverse le lac gelé",
  reachRink: "Rends-toi à la patinoire",
  beatZamboni: "Détruis la Surfaceuse Infernale",
  leaveRink: "Sors de la patinoire",
  survive: (wave: number, total: number) => `Survis à la vague ${wave} sur ${total}`,
  getIcicle: "Ouvre le cadeau sur le toit d'à côté",
  crossRoofs: "Saute de toit en toit jusqu'au Magasin Général",
  crossPlank: "Traverse la planche vers le Magasin Général",
  crossBack: "Retraverse la rue sur la planche",
  climbTower: "Grimpe de toit en toit jusqu'au clocher",
  clearTower: "Débarrasse le toit du clocher",
  getGarland: "Ouvre le cadeau au quai d'expédition",
  crossBelts: "Traverse les tapis roulants",
  clearAssembly: "Débarrasse la chaîne de montage",
  toWorkshop: "Entre dans le Grand Atelier",
  breakValves: (left: number) => `Casse les valves rouges de la machine (${3 - left}/3)`,
  clearWorkshop: "Débarrasse le Grand Atelier",
  getCrossbow: "Ouvre le cadeau dans le paddock",
  clearPaddock: "Débarrasse le paddock",
  toBarn: "Entre dans l'écurie",
  freeReindeer: (left: number) => `Casse les chaînes des rennes captifs (${4 - left}/4)`,
  toCorral: "Va au corral",
  beatComete: "Bats Comète Démoniaque",
  getGatling: "Ouvre le cadeau au pied de la montagne",
  climbTier: (tier: number) => `Grimpe au palier ${tier} de la montagne`,
  clearTier: (tier: number) => `Nettoie le palier ${tier}`,
  clearFoot: "Nettoie le pied de la montagne",
  reachSummit: "Grimpe jusqu'au sommet",
  getStar: "Ramasse l'étoile du grand sapin",
  crossVillage: "Traverse le village",
  toSquare: "Rejoins la place du village",
  beatFouettard: "Bats le Père Fouettard",
  cutStakes: (left: number) => `Casse les piquets qui retiennent sa plateforme (${3 - left}/3)`,
  finishFouettard: "Finis le Père Fouettard",
  clearMarket: "Nettoie la place du marché",
} as const;

export const LINES = {
  intro: [
    l("narrateur", "Il était une fois, au pôle Nord, la veille de Noël…"),
    l(
      "mere",
      "Nicolas! Les tourtières sont prêtes, pis les lutins ont fini d'emballer les cadeaux!",
    ),
    l("pere", "Ho ho ho! Ma belle, ça va être le plus beau Noël de tous les temps!"),
    l(
      "mere",
      "Il manque juste l'étoile sur le grand sapin. Les lutins l'ont cachée en haut des cadeaux, les p'tits comiques.",
    ),
  ],
  tipJump: [
    l(
      "tijos",
      "Saute sur les cadeaux, Père Noël! Pèse deux fois sur Espace pour sauter plus haut. Envoye, envoye!",
    ),
  ],
  tipBounce: [l("tijos", "Le gros cadeau rose, y fait boing! Saute dessus pour monter en haut!")],
  tipBells: [l("mimi", "Y'a trois cloches dorées de cachées dans le village. Trouve-les!")],
  tipPunch: [
    l("lutin", "Tape le bonhomme de neige avec le clic droit! Inquiète-toi pas, y sent rien."),
  ],
  tipDash: [
    l("mimi", "Pèse sur Q pour faire une esquive. C'est pratique pour éviter les boules de neige!"),
  ],
  mereNear: [l("mere", "T'as-tu mis ta tuque, mon vieux? Y fait frette!")],
  starFound: [l("pere", "Ho ho! La voilà! Astheure, au grand sapin.")],
  twistPlace: [l("pere", "Pis… voilà! Joyeux Noël, tout le monde!")],
  twist1: [l("fouettard", "Joyeux Noël, mon frère… Cette année, c'est MON tour.")],
  twist2: [l("mere", "Nicolas!! Lâche-moi, espèce de gros tas de charbon!")],
  twist3: [l("fouettard", "Les lutins sont à moi, astheure. Viens la chercher… si t'es capable.")],
  twist4: [l("possede", "Père… Noël… on a… FAIM.")],
  crate: [
    l("gerard", "Psst! Nicolas! C'est Gérard, du fond de l'atelier. Prends ça pis va la chercher."),
    l("gerard", "Ma vieille canne en sucre. C'est pas grand-chose… mais ça coupe en mautadine."),
  ],
  armed: [l("pere", "…Ho. Ho. Ho.")],
  level0Done: [l("gerard", "La cheminée est ouverte! Va-t'en au marché, y'en a d'autres là-bas.")],
  level1Intro: [
    l("gerard", "Le marché de Noël… y'est plein de lutins possédés. Fais attention à toi."),
    l(
      "gerard",
      "J't'ai laissé un cadeau en avant de toi : mon vieux pistolet à pétards. Ça fait du bruit, au moins.",
    ),
  ],
  level1Wave: [l("possede", "Pas… gentil…")],
  level2Intro: [
    l(
      "gerard",
      "La forêt de sapins… c'est là qu'on venait couper notre sapin, dans le bon vieux temps.",
    ),
    l(
      "gerard",
      "Astheure, c'est plein de brouillard pis de lutins. J'ai laissé un cadeau à côté du char. Ouvre-le!",
    ),
  ],
  level2Gun: [
    l(
      "gerard",
      "J'ai trouvé ça dans l'cabanon. Fais attention, ça recule en mautadine! Pèse sur 1 ou 2 pour changer d'arme.",
    ),
  ],
  level2Lantern: [
    l(
      "gerard",
      "Tape ou tire sur les lanternes pour les allumer. Ça chasse le brouillard, pis ça te fait un point de sauvegarde.",
    ),
  ],
  level2Loot: [
    l("mimi", "Des cadeaux sous les arbres! Déballe-les, y'a des bonnes affaires dedans."),
  ],
  level2Fork: [l("pere", "Deux chemins… À gauche c'est court. À droite… ça sent la tourtière.")],
  level2Sprinters: [l("possede", "Hi hi hi… on te voit pas… mais on te sent…")],
  level2Snowman: [l("pere", "Un bonhomme de neige… avec des dents?! Ayoye.")],
  level2Clearing: [
    l(
      "gerard",
      "Le vieux sapin mort! C'est là que le Fouettard a passé. Fais attention, y'en a plein!",
    ),
  ],
  level2Done: [
    l("gerard", "Bravo, Nicolas. Les traces de traîneau partent vers les glissades… Suis-les!"),
  ],
  level3Intro: [
    l(
      "gerard",
      "Les glissades! Quand j'étais jeune, on descendait ça en tube toute la journée, pis on buvait du cidre chaud au chalet.",
    ),
    l(
      "gerard",
      "J'ai laissé un autre cadeau à côté du chalet. Une mitraillette à bonbons. Les dentistes vont avoir de l'ouvrage!",
    ),
  ],
  level3Tube: [
    l(
      "gerard",
      "Saute dans le tube! A et D pour tourner, W pour accélérer, S pour freiner. Pis tire en descendant!",
    ),
  ],
  level3Throwers: [l("possede", "Du charbon pour le Père Noël! Hi hi hi!")],
  level3CoalTip: [
    l(
      "gerard",
      "Les cercles rouges, c'est là que le charbon va tomber. Tasse-toi! Pis tu peux tirer dessus en l'air.",
    ),
  ],
  level3Bottom: [l("pere", "Ho ho… HO! Encore! … Non, attends. Y'a du monde en bas.")],
  level3Lift: [
    l(
      "gerard",
      "Le télésiège te remonte jusqu'en haut. Mets-toi sur le cercle doré, une chaise va venir te chercher.",
    ),
  ],
  level3LiftRide: [
    l("gerard", "Assis-toi pis profite de la vue… pis tire sur les lanceurs de charbon en chemin!"),
  ],
  level3Top: [
    l(
      "gerard",
      "T'es en haut! La cheminée est ouverte à côté du chalet. Pis si t'as manqué des cloches, y'a des tubes pour redescendre.",
    ),
  ],
  level3Done: [
    l(
      "mere",
      "Nicolas? T'es-tu encore là? J'ai entendu dire que t'avais fait de la glissade… pendant que moi j'suis dans une cage.",
    ),
    l("pere", "C'était pour la bonne cause, ma belle! J'arrive!"),
  ],
  level4Intro: [
    l(
      "gerard",
      "La cabane à sucre à Ti-Poil! D'habitude, ça sent la tire pis les grands-pères dans le sirop. À soir… ça sent le brûlé.",
    ),
    l("pere", "Y'a de la fumée qui sort de la cheminée. Pis des cris. Pas des cris de joie."),
  ],
  level4Flamer: [
    l(
      "gerard",
      "Un lance-flammes à sirop! Ça colle pis ça brûle. Tire sur les flaques de sirop: ça prend en feu, pis les lutins dedans aussi.",
    ),
  ],
  level4Syrup: [
    l("gerard", "Attention au sirop renversé, ça colle aux bottes. Les lutins aussi, remarque."),
  ],
  level4Bombers: [
    l("possede", "Une belle boule pour ton sapin, Père Noël! Hi hi hi!"),
    l(
      "gerard",
      "Des bombardiers! Leurs boules de Noël pètent. Tire dessus dans les airs… pis frappe-les pas de proche: blessés, y foncent sur toi pis y sautent.",
    ),
  ],
  level4Yard: [
    l("pere", "Les chaudrons bouillent encore… pis c'est pas juste du sirop qu'y a dedans."),
    l(
      "gerard",
      "Envoie-les dans le chaudron! Un bon coup de poing, pis c'est de la tire de lutin.",
    ),
  ],
  level4Cauldron: [l("pere", "De la tire sur la neige… version lutin.")],
  level4YardClear: [
    l(
      "gerard",
      "La cour est propre! La porte de la cabane est déverrouillée. Allume la lanterne avant d'entrer.",
    ),
  ],
  level4Feast: [l("possede", "Chut… on mange."), l("pere", "Le réveillon est annulé, les gars.")],
  level4Evap: [l("gerard", "La salle de l'évaporateur! Y'en a qui s'cachent dans la vapeur.")],
  level4Done: [
    l("mere", "Nicolas, ça sent la tire jusqu'icitte. T'en as-tu gardé pour moi?"),
    l("pere", "Une pleine palette, ma belle. Tiens bon."),
    l("fouettard", "La patinoire t'attend, mon frère. Aiguise tes patins."),
  ],
  level5Intro: [
    l(
      "gerard",
      "Le lac est gelé dur. Ça glisse en mautadine: prends ton élan avant de tourner. Les bancs de neige, eux autres, ça colle aux bottes.",
    ),
  ],
  level5Launcher: [
    l("gerard", "Le Lance-Boules! Des boules de Noël qui explosent. Vise la Zamboni!"),
    l("pere", "Quelle Zamboni?"),
    l("gerard", "Tu vas voir."),
  ],
  level5Skaters: [
    l("possede", "Lâche la rondelle, Père Noël! Hi hi hi!"),
    l("gerard", "Des patineurs! Leurs rondelles glissent sur la glace: saute par-dessus."),
  ],
  level5Cracks: [
    l("gerard", "La glace craque là où c'est blanc et fendillé. Reste pas planté dessus!"),
  ],
  level5Splash: [l("pere", "BRRR! Y fait frette dans l'eau, mon doux…")],
  level5Globe: [
    l("gerard", "Une boule à neige! Ramasse-la pis tout ce qui bouge autour de toi va geler."),
  ],
  level5Gate: [l("gerard", "La patinoire est en avant. J'entends un moteur… Mets ta tuque.")],
  bossIntro: [
    l("tiguy", "Bienvenue à la patinoire, Père Noël! La glace est fraîche… pis toi, t'es FINI!"),
    l("pere", "Ti-Guy? Le petit gardien de but? T'étais si fin…"),
    l("tiguy", "J'ai été échangé. Au Père Fouettard. VROUM VROUM!"),
  ],
  bossTip: [
    l(
      "gerard",
      "Quand ses phares clignotent pis qu'y klaxonne, y fonce! Saute de côté. Après, y'est sonné: c'est là qu'y faut taper.",
    ),
  ],
  bossPhase2: [l("tiguy", "Tu veux de la glace? J'vais t'en donner, de la glace!")],
  bossPhase2Tip: [
    l(
      "gerard",
      "La glace est cassée en morceaux! Saute d'un bloc à l'autre, pis tombe pas à l'eau.",
    ),
  ],
  bossLow: [l("tiguy", "Non non non, pas ma Zamboni!")],
  bossDefeat: [
    l("tiguy", "Ma… Zam… boni…"),
    l("pere", "Ça, c'est ce que j'appelle un resurfaçage."),
  ],
  level5Calm: [
    l("pere", "…C'est beau, des aurores boréales. Ma femme aimerait ça."),
    l("gerard", "Va la chercher, d'abord. La sortie est au bord du lac."),
  ],
  level5Done: [
    l("mere", "T'as battu une Zamboni?! Tu m'impressionnes encore après quatre cents ans."),
    l("pere", "Pis j'ai même pas cassé mes lunettes. J'arrive, ma belle."),
  ],
  level6Intro: [
    l(
      "gerard",
      "Le village est envahi, Père Noël! Les rues sont pleines de slush maudite: touches-y pas, ça brûle comme du charbon.",
    ),
    l("pere", "On passe par les toits, d'abord. C'est ma spécialité, les toits."),
  ],
  level6Rifle: [
    l(
      "gerard",
      "Le Fusil à Glaçons! Lent, mais précis: un glaçon passe à travers trois lutins en ligne. Parfait pour ceux qui lancent des affaires des toits d'en face.",
    ),
  ],
  level6Throwers: [l("gerard", "Sur le toit d'en face! Vise bien pis tire, y bougeront pas.")],
  level6Slush: [l("pere", "OUCH! Ça pique, cette slush-là! J'remonte.")],
  level6Plank: [l("gerard", "Une planche par-dessus la rue. Regarde pas en bas.")],
  level6Store: [l("gerard", "Y grimpent sur le toit du Magasin Général! Tiens bon!")],
  level6StoreClear: [
    l("gerard", "Bon débarras! Le clocher est au bout de la rue. Retraverse sur la planche."),
  ],
  level6Climb: [
    l(
      "gerard",
      "Les toits montent vers le clocher. Saute deux fois pour les gros trous, pis sers-toi des boîtes de ventilation comme marches.",
    ),
  ],
  level6Tower: [
    l("fouettard", "Tu montes encore, mon frère? Plus tu montes, plus la chute est longue."),
  ],
  level6Done: [
    l(
      "mere",
      "Nicolas! J'entends des machines pis des jouets qui crient… Y m'amènent à la fabrique!",
    ),
    l("pere", "Ma propre fabrique de jouets… J'arrive, ma belle."),
  ],
  level7Intro: [
    l(
      "gerard",
      "La Fabrique de Jouets… C'est icitte qu'on fabriquait tous les cadeaux. Asteure, les machines fabriquent des monstres.",
    ),
    l("pere", "Mes lutins travaillaient fort ici. J'vais remettre de l'ordre."),
  ],
  level7Gun: [
    l(
      "gerard",
      "La Guirlande Électrique! Des lumières de Noël branchées sur le 600 volts. L'éclair saute d'un lutin à l'autre: plus y sont collés, mieux c'est.",
    ),
  ],
  level7Belts: [
    l("gerard", "Les tapis roulants poussent vers le broyeur! Cours, ou saute par-dessus."),
  ],
  level7Grinder: [l("pere", "AYOYE! Mes bottes! J'vais rester loin de ça.")],
  level7Presses: [
    l(
      "gerard",
      "La chaîne de montage! Les presses écrasent tout ce qui passe en dessous. Les lutins aussi, hé hé… Attire-les là.",
    ),
  ],
  level7Nutcracker: [
    l("gerard", "Des casse-noisettes! Durs comme du bois. Garde tes distances pis tire."),
  ],
  level7AssemblyClear: [
    l("gerard", "La porte du Grand Atelier s'ouvre. La Machine à Jouets est là-dedans."),
  ],
  level7Machine: [
    l(
      "fouettard",
      "Ma belle machine! Elle fabrique des lutins plus vite que tu peux les casser, mon frère.",
    ),
    l("gerard", "Casse les trois valves rouges! Sans pression, la machine va s'étouffer."),
  ],
  level7MachineDown: [
    l("gerard", "La machine est kaput! Nettoie le reste, pis sors par la cheminée."),
  ],
  level7Done: [
    l("mere", "Nicolas! On est dans une écurie… y'a des rennes, mais leurs yeux sont rouges!"),
    l("pere", "Mes rennes? Pas mes rennes… J'arrive, ma belle."),
  ],
  level8Intro: [
    l(
      "gerard",
      "Les écuries des rennes… Le Père Fouettard a mis le feu partout. Pis les rennes… regarde-leur les yeux.",
    ),
    l("pere", "Mes rennes. Qu'est-ce qu'y vous ont fait, mes pauvres bêtes…"),
  ],
  level8Gun: [
    l(
      "gerard",
      "L'Arbalète à Cannes! La canne se plante dans ce que tu touches, pis BOUM une seconde après. Plante-la, pis tasse-toi.",
    ),
  ],
  level8Charge: [
    l(
      "gerard",
      "Attention! Quand un renne baisse la tête pis que ses yeux flashent, y fonce en ligne droite. Esquive avec Q! S'il rentre dans un poteau ou une clôture, y est sonné: finis-le au corps à corps.",
    ),
  ],
  level8Barn: [
    l(
      "gerard",
      "Y'a des bons rennes enchaînés dans les stalles! Casse leurs chaînes pour les libérer.",
    ),
  ],
  level8BarnClear: [
    l(
      "gerard",
      "Tous les rennes sont libres! Mais j'entends quelque chose dans le corral… quelque chose de GROS.",
    ),
  ],
  level8Comete: [
    l(
      "fouettard",
      "Tu te souviens de Comète, mon frère? Le plus rapide de ton attelage. Y est à moi, asteure.",
    ),
    l("pere", "Comète… Mon pauvre Comète."),
  ],
  level8CometeTip: [
    l(
      "gerard",
      "Y est trop dur quand y bouge: tes coups glissent sur lui! Fais-le foncer dans un gros poteau, pis quand y est sonné, vide-lui tout dessus.",
    ),
  ],
  level8CometeHalf: [l("gerard", "Y appelle des lutins en renfort! Garde un œil sur ses cornes.")],
  level8CometeDown: [l("pere", "Repose-toi, Comète. Le Père Fouettard va payer pour ça.")],
  level8Done: [
    l("mere", "Nicolas! Y m'amènent en haut d'une montagne… une montagne de cadeaux! J'ai froid…"),
    l("pere", "Tiens bon, ma belle. Encore une montagne, pis j'arrive."),
  ],
  level9Intro: [
    l(
      "gerard",
      "La Montagne de Cadeaux! Tous les cadeaux volés de la Terre, empilés jusqu'aux nuages. Mère Noël est en haut, j'en suis sûr.",
    ),
    l("pere", "Ben, on monte. Un palier à la fois."),
  ],
  level9Gun: [
    l(
      "gerard",
      "La Gatling à Jujubes! Tiens le clic: les canons tournent, pis ça crache. Tu bouges moins vite quand elle tourne, fait que choisis ta place.",
    ),
  ],
  level9Stairs: [
    l(
      "gerard",
      "Les marches sont jamais du même bord: fais le tour de chaque palier pour trouver les suivantes.",
    ),
  ],
  level9Balls: [
    l(
      "gerard",
      "Des boules de Noël géantes roulent sur le palier! Saute par-dessus ou colle-toi sur le cadeau du milieu.",
    ),
  ],
  level9Fall: [l("pere", "Ouf! Juste un étage plus bas. On remonte.")],
  level9Summit: [
    l("mere", "NICOLAS! Je suis là! Y m'amènent au village!"),
    l("fouettard", "Trop tard, mon frère! Viens la chercher au village… si t'as le courage."),
    l("pere", "Ma belle! J'arrive, lâche pas!"),
  ],
  level9Done: [
    l(
      "gerard",
      "Le traîneau s'en va vers le village… y'est devenu un cauchemar. C'est la dernière ligne droite.",
    ),
    l("pere", "Le Père Fouettard m'attend? Parfait. Moi aussi, je l'attends."),
  ],
  level10Intro: [
    l("gerard", "Le village… c'est pus le même. Le Père Fouettard a tout viré à l'envers."),
    l("pere", "C'est chez nous, ça. Pis ma femme est quelque part là-dedans."),
  ],
  level10Gun: [
    l(
      "gerard",
      "L'étoile du grand sapin! Elle brille encore… Pointe-la sur eux pis tiens le clic: c'est un rayon qui traverse toute!",
    ),
  ],
  level10Square: [
    l("fouettard", "Bienvenue chez vous, mon frère. Ta belle est accrochée dans ton beau sapin."),
    l("mere", "Nicolas! Fais attention, y'est plus fort qu'avant!"),
  ],
  level10WhipTip: [
    l("gerard", "Y lance du charbon ardent! Bouge tout le temps, pis tire-lui dessus."),
  ],
  level10Charge: [
    l("fouettard", "ASSEZ! Tu veux jouer dur? On va jouer dur!"),
    l("mere", "Nicolas! Y'a les yeux tout rouges!"),
    l(
      "gerard",
      "Y fonce comme Comète! Attire-le dans les gros poteaux, pis frappe quand y est sonné.",
    ),
  ],
  level10Sky: [
    l("fouettard", "Si je l'ai pas, personne l'aura!"),
    l(
      "gerard",
      "Sa plateforme tient par trois cordes! Casse les piquets au sol pour la faire tomber!",
    ),
  ],
  level10Freed: [l("mere", "La cage s'est ouverte! Nicolas! T'as réussi!")],
  level10Reunion: [
    l("pere", "Ma belle… T'as rien? Y t'ont pas fait mal?"),
    l("mere", "Pas une égratignure. Pis toi, t'as même pas perdu ta tuque."),
    l("pere", "Ho ho ho! Joyeux Noël, ma belle."),
    l("mere", "Joyeux Noël, mon Nicolas."),
  ],
  level10Last: [
    l("fouettard", "Non… NON! C'est MOI, le vrai Noël! Tout le monde, sur lui!"),
    l("mere", "Nicolas, y'en reste juste un! Lâche pas!"),
  ],
  level10Mere: [l("mere", "Nicolas! Je suis là, dans la cage! Fais attention à lui!")],
  level10Defeat: [l("fouettard", "Non… Pas comme ça… Pas encore…")],
  level10Star: [
    l("mere", "Nicolas… Il manque juste l'étoile sur le grand sapin."),
    l("pere", "Ho ho ho. Cette fois-ci, on la met comme du monde."),
  ],
  level10Elves: [
    l("gerard", "Les lutins sont redevenus normaux! Pis y'ont faim."),
    l("lutin", "Joyeux Noël, Père Noël! On s'excuse pour… toute."),
  ],
  level10Feast: [
    l("mere", "Bon! Qui veut de la tourtière?"),
    l("gerard", "Moi! Pis deux morceaux de bûche!"),
    l("pere", "Ho ho ho! Joyeux Noël, tout le monde!"),
  ],
  barksFreed: ["Sauve-toi, mon beau!", "Cours rejoindre le troupeau!", "T'es libre, mon grand!"],
  level1Done: [
    l("mere", "Nicolas? C'est-tu toi? Y m'ont enfermée dans une cage… mais j'en ai mordu deux!"),
    l("pere", "Tiens bon, ma belle. J'arrive."),
  ],
  barksKill: [
    "Pas de cadeau pour toi!",
    "T'es sur la liste des pas fins!",
    "Retourne à l'atelier!",
    "Ho ho HO!",
  ],
  barksCombo: ["AYOYE!", "C'est ça, l'esprit des Fêtes!"],
  barksLow: ["Mon doux… j'commence à être trop vieux pour ça."],
  barksElf: ["Pas… gentil…", "Biscuits… VIANDE…", "Au lit, Père Noël!", "Hi hi hi…"],
} as const;
