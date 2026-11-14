import { useEffect, useRef, useState } from 'react';
import { parseExplorerLink, explorerLink, searchInputSchema } from '@spherex/contracts';
import { t } from '../../shared/i18n';
import type { ExplorerController } from '../explorer/useExplorer';
import { defaultInput, formFrom } from './search-form';
export function useSearchForm(explorer: ExplorerController) {
  const { view, targets } = explorer;
  const [draft, setDraft] = useState(() => {
    return formFrom(parseExplorerLink(location.search) ?? defaultInput);
  });
  const dirty = useRef(
    new Set<string>(
      new URLSearchParams(location.search).has('ra')
        ? ['ra', 'dec', 'fov', 'target', 'release', 'from', 'to']
        : [],
    ),
  );
  const [targetId, setTargetId] = useState<string | null>(
    new URLSearchParams(location.search).has('ra') ? null : 'wise-0855',
  );
  const [shareText, setShareText] = useState('');
  useEffect(() => {
    if (!view.searchInput && explorer.releases && !dirty.current.has('release'))
      setDraft((current) => ({ ...current, release: explorer.releases!.defaultRelease }));
  }, [explorer.releases, view.searchInput]);
  const urlQueryHandled = useRef(false);
  useEffect(() => {
    const input = parseExplorerLink(location.search);
    if (
      urlQueryHandled.current ||
      !explorer.connected ||
      new URLSearchParams(location.search).get('search') !== '1' ||
      !input
    )
      return;
    urlQueryHandled.current = true;
    dirty.current.clear();
    void explorer.searchObservations(input, null);
  }, [explorer.connected]);
  useEffect(() => {
    if (!view.searchInput) return;
    const incoming = formFrom(view.searchInput);
    setDraft(
      (current) =>
        Object.fromEntries(
          Object.entries(incoming).map(([key, value]) => [
            key,
            dirty.current.has(key) ? current[key as keyof typeof current] : value,
          ]),
        ) as typeof current,
    );
    if (!dirty.current.has('target')) setTargetId(view.targetId);
  }, [view.searchInput, view.targetId]);
  function edit(key: keyof typeof draft, value: string) {
    dirty.current.add(key);
    if (key === 'ra' || key === 'dec') {
      dirty.current.add('target');
      setTargetId(null);
    }
    setDraft((current) => ({ ...current, [key]: value }));
  }
  function choose(id: string) {
    const item = targets.find((target) => target.id === id);
    if (!item) {
      dirty.current.add('target');
      setTargetId(null);
      return;
    }
    dirty.current.add('target');
    dirty.current.add('ra');
    dirty.current.add('dec');
    setTargetId(id);
    setDraft((current) => ({ ...current, ra: String(item.raDeg), dec: String(item.decDeg) }));
  }
  function validatedInput() {
    const result = searchInputSchema.safeParse({
      raDeg: Number(draft.ra),
      decDeg: Number(draft.dec),
      fovDeg: Number(draft.fov),
      fromUtc: draft.from ? `${draft.from}T00:00:00Z` : null,
      toUtc: draft.to ? `${draft.to}T23:59:59Z` : null,
      release: draft.release,
    });
    if (!result.success || !draft.ra.trim() || !draft.dec.trim()) {
      explorer.setNotice(t('Sprawdź RA (0–360°), Dec (−90–90°), pole (0–2°) oraz kolejność dat.'));
      return null;
    }
    return result.data;
  }
  async function doSearch() {
    const input = validatedInput();
    if (!input) return false;
    dirty.current.clear();
    return await explorer.searchObservations(input, targetId);
  }
  async function send(command: string) {
    const input = validatedInput();
    if (!input) return false;
    if (dirty.current.size || !view.searchInput) {
      await explorer.patch({ searchInput: input, targetId });
      dirty.current.clear();
    }
    await explorer.send(command);
    return true;
  }
  async function copyLink(embed = false) {
    const input = validatedInput();
    if (!input) return;
    const url = explorerLink(location.href, input, embed);
    const text = embed
      ? `<iframe src="${url.replaceAll('&', '&amp;')}" title="SPHEREx Explorer" width="100%" height="720" loading="lazy"></iframe>`
      : url;
    setShareText(text);
    try {
      await navigator.clipboard.writeText(text);
      explorer.setNotice(
        embed
          ? t('Kod iframe jest gotowy poniżej. Nie zawiera danych prywatnej sesji.')
          : t('Link jest gotowy poniżej: współrzędne, FOV, wydanie i daty.'),
      );
    } catch {
      explorer.setNotice(t('Zaznacz i skopiuj przygotowany link lub kod poniżej.'));
    }
  }
  const pendingForm =
    view.searchInput && JSON.stringify(formFrom(view.searchInput)) !== JSON.stringify(draft);
  const target = targets.find((item) => item.id === targetId);
  return {
    restoreForm: (input: typeof defaultInput, id: string | null) => {
      dirty.current.clear();
      setDraft(formFrom(input));
      setTargetId(id);
    },
    draft,
    targetId,
    target,
    edit,
    choose,
    doSearch,
    send,
    copyLink,
    shareText,
    pendingForm,
  };
}
