import { useEffect, useState } from 'react';
import { healthSchema } from '@spherex/contracts';

export function App() {
  const [status, setStatus] = useState('Sprawdzanie połączenia…');
  useEffect(() => {
    const controller = new AbortController();
    fetch('/api/v1/health/ready', { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error('API niedostępne');
        const health = healthSchema.parse(await response.json());
        setStatus(`API i MongoDB połączone · tryb ${health.dataMode}`);
      })
      .catch(() => { if (!controller.signal.aborted) setStatus('API niedostępne — uruchom MongoDB i backend.'); });
    return () => controller.abort();
  }, []);

  return <main className="cockpit">
    <header><span className="accent">///</span><h1>SPHEREx Explorer</h1><span className="badge">SZKIELET / 0.1</span></header>
    <p role="status">{status}</p>
    <section className="viewport" aria-labelledby="stage-title">
      <span className="eyebrow">STANOWISKO OBSERWACYJNE</span>
      <h2 id="stage-title">Fundament projektu jest gotowy.</h2>
      <p>React, NestJS, MongoDB i wspólne kontrakty. Kolejny etap to podłączenie obserwacji oraz interaktywnego kokpitu.</p>
      <div className="modules"><span>01 / NAWIGACJA</span><span>02 / OBRAZ NIEBA</span><span>03 / COPILOT</span></div>
    </section>
    <footer>Obrazy SPHEREx i czat nie są jeszcze podłączone. Ten ekran potwierdza uruchomienie szkieletu.</footer>
  </main>;
}
