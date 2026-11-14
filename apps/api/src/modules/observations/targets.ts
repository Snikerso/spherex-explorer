import type { Target } from '@spherex/contracts';

export const TARGETS: Target[] = [
  {
    id: 'wise-0855',
    name: 'WISE 0855',
    raDeg: 133.79512917,
    decDeg: -7.24514722,
    epoch: 'Pozycja referencyjna z treści wyzwania; duży ruch własny',
    sourceUrl: 'https://www.spaceappschallenge.org/2026/challenges/planet-x-and-spherex/',
    description: 'Chłodny brązowy karzeł. Zmieniaj pole, aby objąć jego pozycje w różnych latach.',
  },
  {
    id: 'barnard',
    name: 'Barnard’s Star',
    raDeg: 269.452075,
    decDeg: 4.693391,
    epoch: 'J2000; duży ruch własny',
    sourceUrl: 'https://simbad.cds.unistra.fr/simbad/sim-id?Ident=Barnard%27s+Star',
    description:
      'Gwiazda o dużym ruchu własnym; pole 0,1° obejmuje przesunięcie od epoki katalogowej.',
  },
  {
    id: 'epsilon-indi-b',
    name: 'Epsilon Indi B',
    raDeg: 330.841667,
    decDeg: -56.785833,
    epoch: 'J2000; pozycja referencyjna układu',
    sourceUrl: 'https://simbad.cds.unistra.fr/simbad/sim-id?Ident=eps+Ind+B',
    description: 'Układ brązowych karłów, używany jako test pokrycia archiwum.',
  },
  {
    id: 'rw-aur',
    name: 'RW Aurigae',
    raDeg: 76.956875,
    decDeg: 30.401444,
    epoch: 'J2000',
    sourceUrl: 'https://simbad.cds.unistra.fr/simbad/sim-id?Ident=RW+Aur',
    description: 'Gwiazda zmienna. Różne zakresy spektralne mogą wyglądać inaczej.',
  },
  {
    id: 'r-dra',
    name: 'R Draconis',
    raDeg: 248.019583,
    decDeg: 66.759139,
    epoch: 'J2000',
    sourceUrl: 'https://simbad.cds.unistra.fr/simbad/sim-id?Ident=R+Dra',
    description: 'Gwiazda zmienna. Porównanie wizualne nie zastępuje fotometrii.',
  },
  {
    id: 'm31',
    name: 'Andromeda (M31)',
    aliases: [
      'Andromeda',
      'M31',
      'M 31',
      'Galaktyka Andromedy',
      'Andromedę',
      'Andromede',
      'NGC 224',
    ],
    raDeg: 10.68470833,
    decDeg: 41.26875,
    epoch: 'ICRS / J2000; centrum galaktyki',
    sourceUrl: 'https://simbad.cds.unistra.fr/simbad/sim-id?Ident=M31',
    description:
      'Galaktyka Andromedy. Wybrane pole pokazuje jej centralny fragment, nie całą galaktykę.',
  },
];
