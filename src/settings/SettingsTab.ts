import { App, PluginSettingTab, Setting } from 'obsidian';
import TPSKanbanPlugin from '../main';

const createCollapsibleSection = (
  parent: HTMLElement,
  title: string,
  description?: string,
  defaultOpen = false,
): HTMLElement => {
  const details = parent.createEl('details', { cls: 'tps-collapsible-section' });
  if (defaultOpen) {
    details.setAttr('open', 'true');
  }

  const summary = details.createEl('summary', { cls: 'tps-collapsible-section-summary' });
  summary.createSpan({ cls: 'tps-collapsible-section-title', text: title });

  if (description) {
    details.createEl('p', {
      cls: 'tps-collapsible-section-description',
      text: description,
    });
  }

  return details.createDiv({ cls: 'tps-collapsible-section-content' });
};

export class KanbanSettingTab extends PluginSettingTab {
  plugin: TPSKanbanPlugin;
  private settingsViewState = new Map<string, boolean>();
  private settingsScrollTop = 0;
  private hasRenderedSettings = false;
  constructor(app: App, plugin: TPSKanbanPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;
    this.captureSettingsViewState(containerEl);
    containerEl.empty();
    containerEl.createEl('h2', { text: 'TPS Kanban settings' });
    containerEl.createEl('p', {
      text: "Lanes are defined by the Group By setting in each base view. Use the base's toolbar to configure grouping and sorting.",
      cls: 'setting-item-description',
    });

    this.renderBaseQueryGuide(containerEl);

    const cardFields = createCollapsibleSection(
      containerEl,
      'Card Frontmatter Keys',
      'Keys used to pull visual metadata from each card note.',
      false,
    );

    new Setting(cardFields)
      .setName('Icon property')
      .setDesc('Frontmatter key whose value is a Lucide icon name to display on each card (e.g. icon).')
      .addText(text => text
        .setPlaceholder('icon')
        .setValue(this.plugin.settings.iconKey)
        .onChange(async value => {
          this.plugin.settings.iconKey = value.trim() || 'icon';
          await this.plugin.saveSettings();
        }));

    new Setting(cardFields)
      .setName('Color property')
      .setDesc('Frontmatter key whose value is a CSS color (hex, rgb, named) to use as the card accent (e.g. color).')
      .addText(text => text
        .setPlaceholder('color')
        .setValue(this.plugin.settings.colorKey)
        .onChange(async value => {
          this.plugin.settings.colorKey = value.trim() || 'color';
          await this.plugin.saveSettings();
        }));

    new Setting(cardFields)
      .setName('Frontmatter color applies to')
      .setDesc('Choose whether frontmatter and rule colors affect card accents. Icons keep their note/task identity color.')
      .addDropdown(drop => drop
        .addOption('card', 'Card only')
        .addOption('off', 'Off')
        .setValue(this.plugin.settings.frontmatterColorTarget === 'off' ? 'off' : 'card')
        .onChange(async value => {
          this.plugin.settings.frontmatterColorTarget = value as 'card' | 'off';
          await this.plugin.saveSettings();
        }));

    new Setting(cardFields)
      .setName('Frontmatter value style rules')
      .setDesc('JSON array of rules. Match note frontmatter or task inline fields and apply card color/textStyle. Icons are not changed by these rules.')
      .addTextArea(text => {
        text.inputEl.rows = 8;
        text.inputEl.style.width = '100%';
        text
          .setPlaceholder('[{"label":"Priority: high","conditions":[{"field":"priority","operator":"is","value":"high"}],"color":"#ef4444"}]')
          .setValue(JSON.stringify(this.plugin.settings.cardStyleRules || [], null, 2))
          .onChange(async value => {
            try {
              const parsed = value.trim() ? JSON.parse(value) : [];
              this.plugin.settings.cardStyleRules = Array.isArray(parsed) ? parsed : [];
              await this.plugin.saveSettings();
            } catch {
              // Wait for valid JSON before persisting.
            }
          });
      });

    const laneOrder = createCollapsibleSection(
      containerEl,
      'Lane Behavior',
      'Optional sorting behavior for cards that do not have a group-by value.',
      false,
    );

    new Setting(laneOrder)
      .setName('Ungrouped lane position')
      .setDesc('Where to place cards that have no group-by value.')
      .addDropdown(drop => drop
        .addOption('first', 'First')
        .addOption('last', 'Last')
        .setValue(this.plugin.settings.ungroupedPosition)
        .onChange(async value => {
          this.plugin.settings.ungroupedPosition = value as 'first' | 'last';
          await this.plugin.saveSettings();
        }));

    new Setting(laneOrder)
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
      .addExtraButton((btn) => {
        btn
          .setIcon('reset')
          .setTooltip('Reset to 100%')
          .onClick(async () => {
            this.plugin.settings.scale = 1;
            await this.plugin.saveSettings();
            this.display();
          });
      });

    new Setting(laneOrder)
      .setName('Dynamic empty lane width')
      .setDesc('In board mode, shrink columns that have no cards.')
      .addToggle((toggle) => {
        toggle
          .setValue(!!this.plugin.settings.dynamicEmptyLaneWidth)
          .onChange(async (value) => {
            this.plugin.settings.dynamicEmptyLaneWidth = value;
            await this.plugin.saveSettings();
          });
      });

    new Setting(laneOrder)
      .setName('Card click behavior')
      .setDesc('Choose whether a normal card click shows a Hover Editor preview first or opens the note immediately.')
      .addDropdown((drop) => drop
        .addOption('preview', 'Preview first')
        .addOption('open', 'Open note')
        .setValue(this.plugin.settings.cardActivationMode || 'preview')
        .onChange(async (value) => {
          this.plugin.settings.cardActivationMode = value as 'preview' | 'open';
          await this.plugin.saveSettings();
        }));

    new Setting(laneOrder)
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

    new Setting(laneOrder)
      .setName('Default root task note path')
      .setDesc('Optional. When a task-only Kanban view has no task.path filter, new root tasks are written to this note.')
      .addText(text => text
        .setPlaceholder('Inbox.md')
        .setValue(this.plugin.settings.defaultRootTaskPath || '')
        .onChange(async value => {
          this.plugin.settings.defaultRootTaskPath = value.trim();
          await this.plugin.saveSettings();
        }));

    new Setting(laneOrder)
      .setName('Open task destination after create')
      .setDesc('After creating a root task, open the note that the task was written into.')
      .addToggle((toggle) => toggle
        .setValue(this.plugin.settings.openTaskDestinationAfterCreate !== false)
        .onChange(async (value) => {
          this.plugin.settings.openTaskDestinationAfterCreate = value;
          await this.plugin.saveSettings();
        }));

    const cardContent = createCollapsibleSection(
      containerEl,
      'Card Content',
      'Controls for note-body task previews shown inside cards.',
      false,
    );

    new Setting(cardContent)
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
      .addExtraButton((btn) => {
        btn
          .setIcon('reset')
          .setTooltip('Reset to 5')
          .onClick(async () => {
            this.plugin.settings.openTaskPreviewLimit = 5;
            await this.plugin.saveSettings();
            this.display();
          });
      });

    new Setting(cardContent)
      .setName('Show task overflow count')
      .setDesc('Show a compact +N more row when a card has additional unchecked tasks.')
      .addToggle((toggle) => {
        toggle
          .setValue(this.plugin.settings.showTaskOverflowCount !== false)
          .onChange(async (value) => {
            this.plugin.settings.showTaskOverflowCount = value;
            await this.plugin.saveSettings();
          });
      });

    this.restoreSettingsViewState(containerEl);
  }

  private captureSettingsViewState(containerEl: HTMLElement): void {
    this.settingsScrollTop = containerEl.scrollTop;
    this.settingsViewState.clear();
    const detailsEls = Array.from(containerEl.querySelectorAll('details'));
    detailsEls.forEach((detailsEl, index) => {
      const details = detailsEl as HTMLDetailsElement;
      const summaryText = details.querySelector('summary')?.textContent?.trim() || '';
      this.settingsViewState.set(`${index}:${summaryText}`, details.open);
    });
  }

  private restoreSettingsViewState(containerEl: HTMLElement): void {
    const detailsEls = Array.from(containerEl.querySelectorAll('details'));
    if (!this.hasRenderedSettings) {
      detailsEls.forEach((detailsEl) => {
        (detailsEl as HTMLDetailsElement).removeAttribute('open');
      });
      this.hasRenderedSettings = true;
      containerEl.scrollTop = 0;
      return;
    }
    detailsEls.forEach((detailsEl, index) => {
      const details = detailsEl as HTMLDetailsElement;
      const summaryText = details.querySelector('summary')?.textContent?.trim() || '';
      const isOpen = this.settingsViewState.get(`${index}:${summaryText}`);
      if (isOpen) details.setAttr('open', 'true');
      else details.removeAttribute('open');
    });
    containerEl.scrollTop = this.settingsScrollTop;
  }

  private renderBaseQueryGuide(containerEl: HTMLElement): void {
    const section = createCollapsibleSection(
      containerEl,
      'Base query guide',
      'How TPS Kanban interprets ordinary Obsidian Base filters for visibility, task cards, and task creation defaults.',
      false,
    );

    section.createEl('p', {
      cls: 'setting-item-description',
      text: 'Kanban reads the saved Base filter tree and applies it separately to note cards and checkbox task cards. Use explicit prefixes when a filter should target only one side.',
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
