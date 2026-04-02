// ============================================================
// Dashboard Views — Types & localStorage helpers
// ============================================================

export const MAX_VIEWS = 5;
const STORAGE_KEY = 'hs_deal_risk_views';

// Legacy keys (pre-views era) — used for one-time migration
const LEGACY_FILTERS_KEY = 'hs_deal_risk_filters';
const LEGACY_COLUMNS_KEY = 'hs_deal_risk_visible_columns';
const LEGACY_SORT_KEY = 'hs_deal_risk_sort';

// ---- Types ----

export interface ViewFilters {
    pipeline: string[];
    risk: string;
    reason: string;
    stage: string[];
    owner: string[];
    amountMin: string;
    amountMax: string;
    closeMin: string;
    closeMax: string;
    riskChangeMin: string;
    riskChangeMax: string;
}

export interface ViewSort {
    key: string;
    direction: 'asc' | 'desc';
}

export interface DashboardView {
    id: string;
    name: string;
    filters: ViewFilters;
    columns: string[];
    sort: ViewSort;
}

export interface DashboardViewsState {
    views: DashboardView[];
    activeViewId: string;
}

// ---- Defaults ----

export function createDefaultFilters(): ViewFilters {
    return {
        pipeline: [],
        risk: '',
        reason: '',
        stage: [],
        owner: [],
        amountMin: '',
        amountMax: '',
        closeMin: '',
        closeMax: '',
        riskChangeMin: '',
        riskChangeMax: '',
    };
}

export function createDefaultSort(): ViewSort {
    return { key: 'evaluation_date', direction: 'desc' };
}

function generateId(): string {
    return `view_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

export function createDefaultView(): DashboardView {
    return {
        id: generateId(),
        name: 'Default',
        filters: createDefaultFilters(),
        columns: [],
        sort: createDefaultSort(),
    };
}

export function createBlankView(name: string): DashboardView {
    return {
        id: generateId(),
        name,
        filters: createDefaultFilters(),
        columns: [],
        sort: createDefaultSort(),
    };
}

// ---- localStorage I/O ----

export function loadViews(): DashboardViewsState {
    if (typeof window === 'undefined') {
        const def = createDefaultView();
        return { views: [def], activeViewId: def.id };
    }

    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
        try {
            const parsed: DashboardViewsState = JSON.parse(raw);
            if (parsed.views && parsed.views.length > 0) {
                // Migrate string filter values to arrays for multi-select fields
                for (const view of parsed.views) {
                    const f = view.filters as any;
                    for (const key of ['pipeline', 'stage', 'owner']) {
                        if (typeof f[key] === 'string') {
                            f[key] = f[key] ? [f[key]] : [];
                        }
                    }
                }
                return parsed;
            }
        } catch {
            // fall through to migration / default
        }
    }

    // Try migrating from legacy keys
    const migrated = migrateFromLegacyKeys();
    if (migrated) {
        saveViews(migrated);
        return migrated;
    }

    // Fresh start
    const def = createDefaultView();
    const state: DashboardViewsState = { views: [def], activeViewId: def.id };
    saveViews(state);
    return state;
}

export function saveViews(state: DashboardViewsState): void {
    if (typeof window === 'undefined') return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

// ---- Legacy migration ----

function migrateFromLegacyKeys(): DashboardViewsState | null {
    if (typeof window === 'undefined') return null;

    const legacyFilters = localStorage.getItem(LEGACY_FILTERS_KEY);
    const legacyCols = localStorage.getItem(LEGACY_COLUMNS_KEY);
    const legacySort = localStorage.getItem(LEGACY_SORT_KEY);

    // Nothing to migrate
    if (!legacyFilters && !legacyCols && !legacySort) return null;

    const view = createDefaultView();
    view.name = 'Default';

    if (legacyFilters) {
        try {
            const f = JSON.parse(legacyFilters);
            view.filters = { ...createDefaultFilters(), ...f };
        } catch { /* ignore */ }
    }

    if (legacyCols) {
        try {
            view.columns = JSON.parse(legacyCols);
        } catch { /* ignore */ }
    }

    if (legacySort) {
        try {
            view.sort = JSON.parse(legacySort);
        } catch { /* ignore */ }
    }

    // Remove legacy keys
    localStorage.removeItem(LEGACY_FILTERS_KEY);
    localStorage.removeItem(LEGACY_COLUMNS_KEY);
    localStorage.removeItem(LEGACY_SORT_KEY);

    return { views: [view], activeViewId: view.id };
}
