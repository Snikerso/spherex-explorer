import type { Target } from '@spherex/contracts';
import type { ExplorerController } from '../explorer/useExplorer';
import type { SearchDraft } from '../navigation/search-form';
import type { SkyController } from './hooks/useSkyWorkspace';
export type SkyWorkspaceProps = {
  explorer: ExplorerController;
  sky: SkyController;
  draft: SearchDraft;
  target?: Target;
};
