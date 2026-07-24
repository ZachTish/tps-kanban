import { App, PluginSettingTab, Setting } from 'obsidian';
import TPSKanbanPlugin from '../main';

type KanbanSettingsPage =
  | 'rules-creation'
  | 'cards'
  | 'appearance'
  | 'lanes-layout'
  | 'advanced';

interface KanbanSettingsDestination {
  id: KanbanSettingsPage;
  title: string;
  description: string;
}

const KANBAN_SETTINGS_DESTINATIONS: readonly KanbanSettingsDestination[] = [
  {
    id: 'rules-creation',
    title: 'Rules & creation',
    description: 'Base filters, add behavior, and task destinations.',
  },
  {
    id: 'cards',
    title: 'Cards',
    description: 'Click behavior and open-task previews.',
  },
  {
    id: 'appearance',
    title: 'Appearance',
    description: 'Card icons, colors, and style rules.',
  },
  {
    id: 'lanes-layout',
    title: 'Lanes & layout',
    description: 'Lane placement, sizing, and board density.',
  },
  {
    id: 'advanced',
    title: 'Advanced',
    description: 'Diagnostics for troubleshooting Kanban.',
  },
];

export class KanbanSettingTab extends PluginSettingTab {
  plugin: TPSKanbanPlugin;
  private activeSettingsPage: KanbanSettingsPage = 'rules-creation';
  private renderedSettingsPage: KanbanSettingsPage | null = null;
  private settingsScrollTopByPage = new Map<KanbanSettingsPage, number>();
  private navigatingToPage = false;

  constructor(app: App, plugin: TPSKanbanPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;
    if (this.renderedSettingsPage) {
      this.settingsScrollTopByPage.set(this.renderedSettingsPage, containerEl.scrollTop);
    }

    containerEl.empty();
    containerEl.createEl('h2', { text: 'TPS Kanban settings' });
    containerEl.createEl('p', {
      text: "Lanes are defined by the Group By setting in each Base view. Use the Base toolbar to configure grouping and sorting.",
      cls: 'setting-item-description',
    });

    containerEl.createEl('h3', {
      cls: 'tps-kanban-settings-nav-heading',
      text: 'Choose what to configure',
    });
    containerEl.createEl('p', {
      cls: 'setting-item-description tps-kanban-settings-nav-description',
      text: 'Pick one destination. Base-view choices stay in the board, while these pages control shared Kanban behavior.',
    });
    const navigation = containerEl.createEl('nav', {
      cls: 'tps-kanban-settings-nav',
    });
    navigation.setAttr('aria-label', 'Kanban settings sections');

    for (const destination of KANBAN_SETTINGS_DESTINATIONS) {
      const isActive = destination.id === this.activeSettingsPage;
      const button = navigation.createEl('button', {
        cls: `tps-kanban-settings-route${isActive ? ' is-active' : ''}`,
      });
      button.type = 'button';
      button.id = `tps-kanban-settings-route-${destination.id}`;
      button.setAttr('aria-pressed', String(isActive));
      button.createSpan({
        cls: 'tps-kanban-settings-route-label',
        text: destination.title,
      });
      button.createSpan({
        cls: 'tps-kanban-settings-route-description',
        text: destination.description,
      });
      button.addEventListener('click', () => this.navigateToPage(destination.id));
    }

    const destination = KANBAN_SETTINGS_DESTINATIONS.find(
      (candidate) => candidate.id === this.activeSettingsPage,
    ) ?? KANBAN_SETTINGS_DESTINATIONS[0];
    const page = containerEl.createEl('section', {
      cls: 'tps-kanban-settings-page',
    });
    page.id = `tps-kanban-settings-page-${destination.id}`;
    page.dataset.settingsPage = destination.id;
    page.setAttr('aria-labelledby', `tps-kanban-settings-route-${destination.id}`);

    const pageHeading = page.createEl('h3', {
      cls: 'tps-kanban-settings-page-heading',
      text: destination.title,
    });
    pageHeading.tabIndex = -1;
    page.createEl('p', {
      cls: 'setting-item-description tps-kanban-settings-page-description',
      text: destination.description,
    });

    switch (this.activeSettingsPage) {
      case 'rules-creation':
        this.renderRulesAndCreation(page);
        break;
      case 'cards':
        this.renderCards(page);
        break;
      case 'appearance':
        this.renderAppearance(page);
        break;
      case 'lanes-layout':
        this.renderLanesAndLayout(page);
        break;
      case 'advanced':
        this.renderAdvanced(page);
        break;
    }

    this.renderedSettingsPage = this.activeSettingsPage;
    if (this.navigatingToPage) {
      this.navigatingToPage = false;
      containerEl.scrollTop = 0;
      containerEl
        .querySelector<HTMLElement>('.tps-kanban-settings-route[aria-pressed="true"]')
        ?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
      pageHeading.focus({ preventScroll: true });
      pageHeading.scrollIntoView({ block: 'start' });
      return;
    }
    containerEl.scrollTop = this.settingsScrollTopByPage.get(this.activeSettingsPage) ?? 0;
  }

  private navigateToPage(page: KanbanSettingsPage): void {
    if (page === this.activeSettingsPage) return;
    this.activeSettingsPage = page;
    this.navigatingToPage = true;
    this.display();
  }

  private renderRulesAndCreation(page: HTMLElement): void {
    new Setting(page)
      .setName('Card add button default')
      .setDesc('Choose whether the + button on a card creates a linked note subitem or an inline task in that card note.')
      .addDropdown((drop) => drop
        .addOption('note', 'Linked note subitem')
        .addOption('task', 'Inline task')
        .setValue(this.plugin.settings.cardAddButtonDefault || 'note')
        .onChange(async (value) => {
          this.plugin.settings.cardAddButtonDefault = value as 'note' | 'task';
          await this.plugin.saveSettings();
        }));

    new Setting(page)
      .setName('Default root task note path')
      .setDesc('Optional. When a task-only Kanban view has no task.path filter, new root tasks are written to this note.')
      .addText((text) => text
        .setPlaceholder('Inbox.md')
        .setValue(this.plugin.settings.defaultRootTaskPath || '')
        .onChange(async (value) => {
          this.plugin.settings.defaultRootTaskPath = value.trim();
          await this.plugin.saveSettings();
        }));

    new Setting(page)
      .setName('Open task destination after create')
      .setDesc('After creating a root task, open the note that the task was written into.')
      .addToggle((toggle) => toggle
        .setValue(this.plugin.settings.openTaskDestinationAfterCreate !== false)
        .onChange(async (value) => {
          this.plugin.settings.openTaskDestinationAfterCreate = value;
          await this.plugin.saveSettings();
        }));

    this.renderBaseQueryGuide(page);
  }

  private renderCards(page: HTMLElement): void {
    new Setting(page)
      .setName('Card click behavior')
      .setDesc('Choose whether a normal card click shows a Hover Editor preview first or opens the note immediately.')
      .addDropdown((drop) => drop
        .addOption('preview', 'Preview first')
        .addOption('open', 'Open note')
        .setValue(this.plugin.settings.cardActivationMode || 'open')
        .onChange(async (value) => {
          this.plugin.settings.cardActivationMode = value as 'preview' | 'open';
          await this.plugin.saveSettings();
        }));

    new Setting(page)
      .setName('Open task preview limit')
      .setDesc('Maximum number of unchecked body tasks to show on each card.')
      .addSlider((slider) => {
        slider
          .setLimits(0, 20, 1)
          .setDynamicTooltip()
          .setValue(Number(this.plugin.settings.openTaskPreviewLimit ?? 5))
          .onChange(async (value) => {
            this.plugin.settings.openTaskPreviewLimit = value;
            await this.plugin.saveSettings();
          });
      })
      .addExtraButton((button) => {
        button
          .setIcon('reset')
          .setTooltip('Reset to 5')
          .onClick(async () => {
            this.plugin.settings.openTaskPreviewLimit = 5;
            await this.plugin.saveSettings();
            this.display();
          });
      });

    new Setting(page)
      .setName('Show task overflow count')
      .setDesc('Show a compact +N more row when a card has additional unchecked tasks.')
      .addToggle((toggle) => toggle
        .setValue(this.plugin.settings.showTaskOverflowCount !== false)
        .onChange(async (value) => {
          this.plugin.settings.showTaskOverflowCount = value;
          await this.plugin.saveSettings();
        }));
  }

  private renderAppearance(page: HTMLElement): void {
    new Setting(page)
      .setName('Icon property')
      .setDesc('Frontmatter key whose value is a Lucide icon name to display on each card (e.g. icon).')
      .addText((text) => text
        .setPlaceholder('icon')
        .setValue(this.plugin.settings.iconKey)
        .onChange(async (value) => {
          this.plugin.settings.iconKey = value.trim() || 'icon';
          await this.plugin.saveSettings();
        }));

    new Setting(page)
      .setName('Color property')
      .setDesc('Frontmatter key whose value is a CSS color (hex, rgb, named) to use as the card accent (e.g. color).')
      .addText((text) => text
        .setPlaceholder('color')
        .setValue(this.plugin.settings.colorKey)
        .onChange(async (value) => {
          this.plugin.settings.colorKey = value.trim() || 'color';
          await this.plugin.saveSettings();
        }));

    new Setting(page)
      .setName('Frontmatter color applies to')
      .setDesc('Choose whether frontmatter and rule colors affect card accents. Icons keep their note/task identity color.')
      .addDropdown((drop) => drop
        .addOption('card', 'Card only')
        .addOption('off', 'Off')
        .setValue(this.plugin.settings.frontmatterColorTarget === 'off' ? 'off' : 'card')
        .onChange(async (value) => {
          this.plugin.settings.frontmatterColorTarget = value as 'card' | 'off';
          await this.plugin.saveSettings();
        }));

    new Setting(page)
      .setName('Frontmatter value style rules')
      .setDesc('JSON array of rules. Match note frontmatter or task inline fields and apply card color/textStyle. Icons are not changed by these rules.')
      .addTextArea((text) => {
        text.inputEl.rows = 8;
        text.inputEl.style.width = '100%';
        text
          .setPlaceholder('[{"label":"Priority: high","conditions":[{"field":"priority","operator":"is","value":"high"}],"color":"#ef4444"}]')
          .setValue(JSON.stringify(this.plugin.settings.cardStyleRules || [], null, 2))
          .onChange(async (value) => {
            try {
              const parsed = value.trim() ? JSON.parse(value) : [];
              this.plugin.settings.cardStyleRules = Array.isArray(parsed) ? parsed : [];
              await this.plugin.saveSettings();
            } catch {
              // Wait for valid JSON before persisting.
            }
          });
      });
  }

  private renderLanesAndLayout(page: HTMLElement): void {
    page.createEl('p', {
      cls: 'tps-kanban-settings-context-note',
      text: 'Board/list mode, manual lane order, lane labels, and completed-task visibility are saved per Base view and are changed from that Kanban view.',
    });

    new Setting(page)
      .setName('Ungrouped lane position')
      .setDesc('Where to place cards that have no group-by value.')
      .addDropdown((drop) => drop
        .addOption('first', 'First')
        .addOption('last', 'Last')
        .setValue(this.plugin.settings.ungroupedPosition)
        .onChange(async (value) => {
          this.plugin.settings.ungroupedPosition = value as 'first' | 'last';
          await this.plugin.saveSettings();
        }));

    new Setting(page)
      .setName('Kanban scale')
      .setDesc('Scale board sizing from 50% to 140%.')
      .addSlider((slider) => {
        slider
          .setLimits(50, 140, 5)
          .setDynamicTooltip()
          .setValue(Math.round((this.plugin.settings.scale || 1) * 100))
          .onChange(async (value) => {
            this.plugin.settings.scale = value / 100;
            await this.plugin.saveSettings();
          });
      })
      .addExtraButton((button) => {
        button
          .setIcon('reset')
          .setTooltip('Reset to 100%')
          .onClick(async () => {
            this.plugin.settings.scale = 1;
            await this.plugin.saveSettings();
            this.display();
          });
      });

    new Setting(page)
      .setName('Dynamic empty lane width')
      .setDesc('In board mode, shrink columns that have no cards.')
      .addToggle((toggle) => toggle
        .setValue(!!this.plugin.settings.dynamicEmptyLaneWidth)
        .onChange(async (value) => {
          this.plugin.settings.dynamicEmptyLaneWidth = value;
          await this.plugin.saveSettings();
        }));
  }

  private renderAdvanced(page: HTMLElement): void {
    new Setting(page)
      .setName('Enable debug logging')
      .setDesc('Logs Kanban lifecycle, settings saves, Base filter reads, lane add decisions, task creation, note creation, and edit failures. Errors are always logged.')
      .addToggle((toggle) => toggle
        .setValue(!!this.plugin.settings.enableLogging)
        .onChange(async (value) => {
          this.plugin.settings.enableLogging = value;
          await this.plugin.saveSettings();
        }));
  }

  private renderBaseQueryGuide(parent: HTMLElement): void {
    const guide = parent.createDiv({ cls: 'tps-kanban-settings-base-guide' });
    guide.setAttr('aria-label', 'Base query guide');
    guide.createEl('h4', { text: 'Base rules at a glance' });
    guide.createEl('p', {
      cls: 'setting-item-description',
      text: 'Kanban reads the saved Base filter tree and applies it separately to note cards and checkbox task cards. Explicit note. and task. prefixes make both matching and creation defaults predictable.',
    });

    const essentials = guide.createEl('ul');
    essentials.createEl('li', { text: 'Use kind == "note" for notes, kind == "task" for checkbox tasks, or ordered OR branches for mixed views.' });
    essentials.createEl('li', { text: 'Use note.tags/note.status for note frontmatter and task.tags/task.status for inline tasks; bare fields are shared.' });
    essentials.createEl('li', { text: 'Use task.path to choose the note scanned for tasks and to provide the root-task creation destination.' });
    essentials.createEl('li', { text: 'Positive task.path, task.status, task.tags, and simple equality filters can become defaults for newly created tasks.' });

    const reference = guide.createEl('details', {
      cls: 'tps-kanban-settings-base-reference',
    });
    reference.createEl('summary', {
      text: 'Open full Base filter reference',
      cls: 'tps-kanban-settings-base-reference-summary',
    });
    const section = reference.createDiv({
      cls: 'tps-kanban-settings-base-reference-content',
    });

    section.createEl('p', {
      cls: 'setting-item-description',
      text: 'Use explicit prefixes when a filter should target only notes or only checkbox task lines.',
    });

    const defaults = section.createEl('ul');
    defaults.createEl('li', { text: 'Use kind == "note" for note cards only, kind == "task" for checkbox task cards only, and OR branches for mixed views.' });
    defaults.createEl('li', { text: 'Use note.tags/note.status for note frontmatter only. Use task.tags/task.status for inline task lines only.' });
    defaults.createEl('li', { text: 'Bare tags, status, and custom fields are shared: they can match note frontmatter or task inline values.' });
    defaults.createEl('li', { text: 'Use file.ext == "md" to keep only note cards. Task cards have no item extension, so this excludes task rows.' });
    defaults.createEl('li', { text: 'Use task.file.ext == "md" to target the markdown file that contains a task.' });
    defaults.createEl('li', { text: 'Use file.path == "Folder/File" or task.path == "Folder/File" inside task branches to limit task scanning to one note. Without a path, task tag/status filters scan markdown task lines.' });
    defaults.createEl('li', { text: 'Positive task.path, task.status, and task.tags filters can become defaults when creating new root task cards.' });
    defaults.createEl('li', { text: 'Supported text forms include ==, is, contains, has, exists(), isNotEmpty(), isEmpty(), and is empty. Use quoted tag values in .base text, for example tags.contains("#test").' });

    section.createEl('h4', { text: 'Accessible filter variables' });
    const variables = section.createEl('ul');
    variables.createEl('li', { text: 'kind, itemType, itemKind: note, task, bullet, mixed, or all. Use note/task in normal views; bullet is only for explicit bullet-only boards.' });
    variables.createEl('li', { text: 'tags, tag: shared note frontmatter tags OR task inline tags.' });
    variables.createEl('li', { text: 'status: shared note frontmatter status OR task checkbox-derived status.' });
    variables.createEl('li', { text: '<frontmatterKey>: shared note frontmatter OR task inline field with the same key, for example priority.' });
    variables.createEl('li', { text: 'note.tags, file.tags: note frontmatter/cache tags only.' });
    variables.createEl('li', { text: 'note.status and note.<frontmatterKey>: note frontmatter only.' });
    variables.createEl('li', { text: 'task.tags, task.tag: inline tags on checkbox task lines only.' });
    variables.createEl('li', { text: 'task.status: checkbox-derived task status. Unchecked maps to todo; checked maps to complete; custom checkbox states use your status mapping.' });
    variables.createEl('li', { text: 'task.open, task.done, task.completed, task.complete: boolean task completion helpers.' });
    variables.createEl('li', { text: 'file.path, path, task.path, task.file.path, task.file: note path for note cards and containing note path for task cards.' });
    variables.createEl('li', { text: 'file.ext, file.extension, ext, extension: item extension. Note cards are md; task cards are empty for this check.' });
    variables.createEl('li', { text: 'task.file.ext, task.file.extension: extension of the markdown note containing the task.' });
    variables.createEl('li', { text: 'task.<inlineKey>: task inline field only, for example task.priority matches [priority:: high].' });

    section.createEl('h4', { text: 'Examples' });
    this.renderGuideExample(section, 'All views filter: inbox tasks, todo notes, untagged tasks', [
      'filters:',
      '  or:',
      '    - and:',
      '        - status == "todo"',
      '        - file.ext == "md"',
      '    - and:',
      '        - kind == "task"',
      '        - file.path == "Inbox"',
      '    - and:',
      '        - kind == "task"',
      '        - task.tags.isEmpty()',
    ]);
    this.renderGuideExample(section, 'All notes and tasks tagged #test', [
      'filters:',
      '  and:',
      '    - tags.contains("#test")',
    ]);
    this.renderGuideExample(section, 'Only notes tagged #test', [
      'filters:',
      '  and:',
      '    - note.tags.contains("#test")',
      '    - file.ext == "md"',
    ]);
    this.renderGuideExample(section, 'Only checkbox tasks tagged #test', [
      'filters:',
      '  and:',
      '    - kind == "task"',
      '    - task.tags.contains("#test")',
    ]);
    this.renderGuideExample(section, 'Fast task tag filter limited to Inbox', [
      'filters:',
      '  and:',
      '    - kind == "task"',
      '    - task.path == "00 Inbox/00 Inbox"',
      '    - task.tags.contains("#test")',
    ]);
    this.renderGuideExample(section, 'Task board in one tag bucket', [
      'filters:',
      '  and:',
      '    - kind == "task"',
      '    - task.tags.contains("#type/task/toget")',
      '    - task.done == false',
    ]);
    this.renderGuideExample(section, 'Additional included items without ambiguous creation defaults', [
      'filters:',
      '  and:',
      '    - task.tags.contains("#type/task/toget")',
      '    - or:',
      '        - task.status == "todo"',
      '        - task.status == "working"',
    ]);
    this.renderGuideExample(section, 'Create new tasks in a specific file', [
      'filters:',
      '  and:',
      '    - kind == "task"',
      '    - task.path == "Collections/Toget.md"',
      '    - task.tags.contains("#type/task/toget")',
    ]);
    this.renderGuideExample(section, 'Note cards with a folder and status filter', [
      'filters:',
      '  and:',
      '    - file.path.contains("Projects/")',
      '    - status == "active"',
    ]);
  }

  private renderGuideExample(parent: HTMLElement, title: string, lines: string[]): void {
    parent.createEl('div', { cls: 'setting-item-name tps-kanban-guide-example-title', text: title });
    parent.createEl('pre', { cls: 'tps-kanban-guide-example', text: lines.join('\n') });
  }
}
