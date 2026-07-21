import { Plugin, QueryController, BasesView, type BasesAllOptions, type BasesViewConfig } from 'obsidian';
import { KanbanView, KANBAN_VIEW_TYPE } from './views/KanbanView';
import {
  DEFAULT_SETTINGS,
  KanbanSettings,
  normalizeCardStyleRules,
  normalizeFrontmatterColorTarget,
} from './settings';
import { KanbanSettingTab } from './settings/SettingsTab';
import { SettingsPersistenceCoordinator } from './settings-persistence';
import { NATIVE_PREVIEW_SOURCE } from './preview';
import { flow, flowError, setLoggingEnabled } from './logger';

function createBaseCreateButtonOptions(config: BasesViewConfig): BasesAllOptions[] {
  return [
    {
      type: 'group',
      displayName: 'Create button',
      items: [
        {
          key: 'createAction',
          type: 'dropdown',
          displayName: 'Action',
          default: 'default',
          options: {
            default: 'Default',
            command: 'Run command',
          },
        },
        {
          key: 'createCommandId',
          type: 'text',
          displayName: 'Command ID',
          placeholder: 'plugin-id:command-id',
          shouldHide: () => String(config.get('createAction') || '').trim() !== 'command',
        },
      ],
    },
  ];
}

export default class TPSKanbanPlugin extends Plugin {
  settings: KanbanSettings = DEFAULT_SETTINGS;
  private static readonly MIN_SCALE = 0.5;
  private static readonly MAX_SCALE = 1.4;
  private settingsPersistence: SettingsPersistenceCoordinator<KanbanSettings> | null = null;

  async onload() {
    this.settings = this.normalizeSettings(await this.loadData() as Partial<KanbanSettings> || {});
    setLoggingEnabled(this.settings.enableLogging);
    flow('Plugin', 'load', {
      scale: this.settings.scale,
      cardAddButtonDefault: this.settings.cardAddButtonDefault,
      cardActivationMode: this.settings.cardActivationMode,
    });
    this.settings.scale = this.normalizeScale(this.settings.scale);
    if (!this.settings.layoutModeByView || typeof this.settings.layoutModeByView !== 'object') {
      this.settings.layoutModeByView = {};
    }
    if (!this.settings.showCompletedTasksByView || typeof this.settings.showCompletedTasksByView !== 'object') {
      this.settings.showCompletedTasksByView = {};
    }
    if (typeof this.settings.dynamicEmptyLaneWidth !== 'boolean') {
      this.settings.dynamicEmptyLaneWidth = false;
    }
    if (!this.settings.laneLabelAliasesByView || typeof this.settings.laneLabelAliasesByView !== 'object') {
      this.settings.laneLabelAliasesByView = {};
    }
    if (this.settings.cardActivationMode !== 'preview' && this.settings.cardActivationMode !== 'open') {
      this.settings.cardActivationMode = DEFAULT_SETTINGS.cardActivationMode;
    }
    if (this.settings.cardAddButtonDefault !== 'note' && this.settings.cardAddButtonDefault !== 'task') {
      this.settings.cardAddButtonDefault = DEFAULT_SETTINGS.cardAddButtonDefault;
    }
    if (typeof this.settings.defaultRootTaskPath !== 'string') {
      this.settings.defaultRootTaskPath = DEFAULT_SETTINGS.defaultRootTaskPath;
    }
    if (typeof this.settings.openTaskDestinationAfterCreate !== 'boolean') {
      this.settings.openTaskDestinationAfterCreate = DEFAULT_SETTINGS.openTaskDestinationAfterCreate;
    }
    this.settings.openTaskPreviewLimit = this.normalizeOpenTaskPreviewLimit(this.settings.openTaskPreviewLimit);
    if (typeof this.settings.showTaskOverflowCount !== 'boolean') {
      this.settings.showTaskOverflowCount = DEFAULT_SETTINGS.showTaskOverflowCount;
    }
    this.settingsPersistence = new SettingsPersistenceCoordinator<KanbanSettings>({
      loadLatest: () => this.loadData(),
      saveMerged: (settings) => this.saveData(settings),
      normalize: (stored) => this.normalizeSettings(stored as Partial<KanbanSettings>),
      onPersisted: (requested, persisted) => this.reconcilePersistedSettings(requested, persisted),
    }, this.settings);
    this.registerBasesView(KANBAN_VIEW_TYPE, {
      name: 'Kanban',
      icon: 'columns',
      factory: (controller: QueryController, containerEl: HTMLElement): BasesView =>
        new KanbanView(controller, containerEl, this),
      options: createBaseCreateButtonOptions,
    });

    this.addSettingTab(new KanbanSettingTab(this.app, this));
    this.registerHoverLinkSource(NATIVE_PREVIEW_SOURCE, {
      display: 'TPS Kanban',
      defaultMod: false,
    });
  }

  async saveSettings() {
    const persistence = this.settingsPersistence;
    if (!persistence) throw new Error('TPS Kanban settings persistence is not initialized');

    setLoggingEnabled(this.settings.enableLogging);
    flow('Settings', 'save:start', {
      enableLogging: this.settings.enableLogging,
      cardAddButtonDefault: this.settings.cardAddButtonDefault,
      cardActivationMode: this.settings.cardActivationMode,
      scale: this.settings.scale,
    });
    try {
      await persistence.request(this.settings);
      setLoggingEnabled(this.settings.enableLogging);
      this.refreshKanbanViewsFromSettings();
      flow('Settings', 'save:done');
    } catch (error) {
      flowError('Settings', 'save:failed', error);
      throw error;
    }
  }

  onunload() {
    flow('Plugin', 'unload');
  }

  private normalizeSettings(stored: Partial<KanbanSettings>): KanbanSettings {
    return {
      enableLogging: typeof stored.enableLogging === 'boolean'
        ? stored.enableLogging
        : DEFAULT_SETTINGS.enableLogging,
      iconKey: typeof stored.iconKey === 'string' && stored.iconKey.trim()
        ? stored.iconKey.trim()
        : DEFAULT_SETTINGS.iconKey,
      colorKey: typeof stored.colorKey === 'string' && stored.colorKey.trim()
        ? stored.colorKey.trim()
        : DEFAULT_SETTINGS.colorKey,
      frontmatterColorTarget: normalizeFrontmatterColorTarget(stored.frontmatterColorTarget),
      cardStyleRules: normalizeCardStyleRules(stored.cardStyleRules),
      ungroupedPosition: stored.ungroupedPosition === 'first' || stored.ungroupedPosition === 'last'
        ? stored.ungroupedPosition
        : DEFAULT_SETTINGS.ungroupedPosition,
      laneOrderByView: stored.laneOrderByView && typeof stored.laneOrderByView === 'object'
        ? stored.laneOrderByView
        : {},
      scale: this.normalizeScale(stored.scale),
      layoutModeByView: stored.layoutModeByView && typeof stored.layoutModeByView === 'object'
        ? stored.layoutModeByView
        : {},
      showCompletedTasksByView: stored.showCompletedTasksByView && typeof stored.showCompletedTasksByView === 'object'
        ? stored.showCompletedTasksByView
        : {},
      dynamicEmptyLaneWidth: typeof stored.dynamicEmptyLaneWidth === 'boolean'
        ? stored.dynamicEmptyLaneWidth
        : DEFAULT_SETTINGS.dynamicEmptyLaneWidth,
      laneLabelAliasesByView: stored.laneLabelAliasesByView && typeof stored.laneLabelAliasesByView === 'object'
        ? stored.laneLabelAliasesByView
        : {},
      cardActivationMode: stored.cardActivationMode === 'open' || stored.cardActivationMode === 'preview'
        ? stored.cardActivationMode
        : DEFAULT_SETTINGS.cardActivationMode,
      cardAddButtonDefault: stored.cardAddButtonDefault === 'task' || stored.cardAddButtonDefault === 'note'
        ? stored.cardAddButtonDefault
        : DEFAULT_SETTINGS.cardAddButtonDefault,
      defaultRootTaskPath: typeof stored.defaultRootTaskPath === 'string'
        ? stored.defaultRootTaskPath.trim()
        : DEFAULT_SETTINGS.defaultRootTaskPath,
      openTaskDestinationAfterCreate: typeof stored.openTaskDestinationAfterCreate === 'boolean'
        ? stored.openTaskDestinationAfterCreate
        : DEFAULT_SETTINGS.openTaskDestinationAfterCreate,
      openTaskPreviewLimit: this.normalizeOpenTaskPreviewLimit(stored.openTaskPreviewLimit),
      showTaskOverflowCount: typeof stored.showTaskOverflowCount === 'boolean'
        ? stored.showTaskOverflowCount
        : DEFAULT_SETTINGS.showTaskOverflowCount,
    };
  }

  private normalizeScale(value: unknown): number {
    const numeric = typeof value === 'number' ? value : Number(value);
    if (!Number.isFinite(numeric)) return DEFAULT_SETTINGS.scale;
    return Math.max(TPSKanbanPlugin.MIN_SCALE, Math.min(TPSKanbanPlugin.MAX_SCALE, numeric));
  }

  private normalizeOpenTaskPreviewLimit(value: unknown): number {
    const numeric = typeof value === 'number' ? value : Number(value);
    if (!Number.isFinite(numeric)) return DEFAULT_SETTINGS.openTaskPreviewLimit;
    return Math.max(0, Math.min(20, Math.floor(numeric)));
  }

  private reconcilePersistedSettings(requested: KanbanSettings, persisted: KanbanSettings): void {
    const currentRecord = this.settings as unknown as Record<string, unknown>;
    const requestedRecord = requested as unknown as Record<string, unknown>;
    const persistedRecord = persisted as unknown as Record<string, unknown>;

    for (const key of Object.keys(persistedRecord)) {
      if (JSON.stringify(currentRecord[key]) === JSON.stringify(requestedRecord[key])) {
        currentRecord[key] = JSON.parse(JSON.stringify(persistedRecord[key]));
      }
    }
  }

  private refreshKanbanViewsFromSettings(): void {
    const scale = this.normalizeScale(this.settings.scale);
    const viewMap = this.settings.layoutModeByView || {};

    this.app.workspace.iterateAllLeaves((leaf) => {
      if (leaf.view.getViewType() === KANBAN_VIEW_TYPE) {
        const view = leaf.view as unknown as KanbanView;
        view.applyLayoutSettings();
      }
    });

    // Fallback for Bases-hosted kanban instances where leaf view type may not match KANBAN_VIEW_TYPE.
    document.querySelectorAll<HTMLElement>('.tps-kanban-container').forEach((el) => {
      el.style.setProperty('--tps-kanban-scale', String(scale));
      const viewId = el.dataset.kanbanViewId || '';
      const mode = viewMap[viewId] || 'board';
      el.classList.toggle('tps-kanban-container--list', mode === 'list');
    });
  }
}
