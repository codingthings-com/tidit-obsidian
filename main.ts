import {
	App,
	Editor,
	MarkdownView,
	MomentFormatComponent,
	Notice,
	Plugin,
	PluginSettingTab,
	Setting,
	moment,
} from "obsidian";
import * as momentTimezone from "moment-timezone";

interface TiditPluginSettings {
	tiditOn: boolean;
	timestampFormat: string;
	addAfterDelay: number;
	insertNewLineAfterTimestamp: boolean;
	timezone: string;
	useManualTimezoneOffset: boolean;
	timezoneOffset: number;
}

const DEFAULT_SETTINGS: TiditPluginSettings = {
	tiditOn: true,
	timestampFormat: "YYYY-MM-DD HH:mm:ssZ",
	addAfterDelay: 60,
	insertNewLineAfterTimestamp: false,
	timezone: "local",
	useManualTimezoneOffset: false,
	timezoneOffset: 0,
};

export default class TiditPlugin extends Plugin {
	settings: TiditPluginSettings;
	statusBarItemEl: HTMLElement;
	lastTimeStampInsertTimestamp: moment.Moment;
	currFileName: string;

	insertTextAtLine(editor: Editor, line: number, pos: number, timestamp: string) {
		const formattedTimestamp = this.settings.insertNewLineAfterTimestamp ? timestamp : `${timestamp}`;
		editor.replaceRange(formattedTimestamp, { line: line, ch: pos });
	}

	getFormattedTimestamp(): string {
		let timestampMoment = moment();
		
		if (this.settings.timezone !== "local" && this.settings.timezone !== "UTC") {
			// Use moment-timezone for non-local/UTC timezones
			timestampMoment = momentTimezone.tz(moment(), this.settings.timezone);
		} else if (this.settings.timezone === "UTC") {
			// For UTC, use moment().utc()
			timestampMoment = moment().utc();
		}
		
		// Apply manual offset if enabled and specified
		if (this.settings.useManualTimezoneOffset && this.settings.timezoneOffset !== 0) {
			timestampMoment = timestampMoment.utcOffset(this.settings.timezoneOffset);
		}
		
		const timestamp = timestampMoment.format(this.settings.timestampFormat);
		return this.settings.insertNewLineAfterTimestamp
			? `${timestamp}\n`
			: `${timestamp} `;
	}

	resetTimeStampInsertTimestamp() {
		this.lastTimeStampInsertTimestamp = moment(0);
	}

	isCursorInListLine(line: string): boolean {
		// Check if the current line is a list item (starts with '-', '*', or a number)
		return /^\s*[-*+]\s/.test(line) || /^\s*\d+\.\s/.test(line);
	}

	isCodeBlockStartEnd(line: string): boolean {
		return line.startsWith("`") || line.endsWith("```");
	}

	getInsertPositionInLine(editor: Editor): number {
		const cursor = editor.getCursor();
		// line already moved with the ENTER key. look back one line
		const lineText = editor.getLine(cursor.line - 1);
		
		if (this.isCursorInListLine(lineText)) {
			return -1;
		}

		if (this.isCodeBlockStartEnd(lineText)) {
			return -1;
		}

		// Check if the beginning of the line matches a datetime string with the format
		const timestampFormat = this.settings.timestampFormat;
		const formattedTimestampLength = moment().format(timestampFormat).length;

		try {
			// strict mode to ensure exact match
			const matchTimeStamp = moment(
				lineText.trim().substring(0, formattedTimestampLength),
				timestampFormat,
				true
			);
			if (matchTimeStamp.isValid()) {
				return -1; 	// Don't insert if it matches the timestamp format
			}
		} catch {
			// If parsing fails, it's not a matching timestamp format
			return -1;
		}

		return 0;
	}

	async onload() {
		await this.loadSettings();
		
		const activeEditor = this.app.workspace.activeEditor;
		if (activeEditor?.file) {
			this.currFileName = activeEditor.file.name;
		} else {
			this.currFileName = "";
		}

		this.resetTimeStampInsertTimestamp();

		this.statusBarItemEl = this.addStatusBarItem();

		this.addCommand({
			id: "on-off",
			name: "Turn auto-timestamp on/off",
			editorCallback: (editor: Editor, view: MarkdownView) => {
				this.settings.tiditOn = !this.settings.tiditOn;

				this.updateStatusText();

				new Notice(
					this.settings.tiditOn
						? "tidit will add timestamps to your document"
						: "tidit will stop adding timestamps to your document"
				);
			},
		});

		this.addCommand({
			id: "insert-timestamp",
			name: "Insert timestamp at position",
			editorCallback: (editor: Editor) => {
				const cursor = editor.getCursor();
				const timestamp = this.getFormattedTimestamp();
				this.insertTextAtLine(editor, cursor.line, cursor.ch, timestamp);
				editor.setCursor(cursor.line, timestamp.length + cursor.ch);
			},
		});

		this.addSettingTab(new TiditSettingTab(this.app, this));

		this.registerDomEvent(document, "keydown", (e: KeyboardEvent) => {
			if (!this.settings.tiditOn) return;

			if (e.key !== "Enter") return;

			const activeEditor = this.app.workspace.activeEditor;
			const editor = activeEditor?.editor;
			
			if (!editor) return;

			const file = activeEditor?.file;
			if (file) {
				// reset timestamp upon file / tab change
				if (this.currFileName !== file.name) {
					this.currFileName = file.name;
					this.resetTimeStampInsertTimestamp();
				}
			} else {
				return;
			}

			const cursor = editor.getCursor();

			const now = moment();
			if (
				now.diff(this.lastTimeStampInsertTimestamp, "seconds") <
				this.settings.addAfterDelay
			) {
				return;
			}

			const pos = this.getInsertPositionInLine(editor);
			if (pos === -1) {
				return;
			}

			const timestamp = this.getFormattedTimestamp();

			// Insert timestamp at the beginning of the previous line
			this.insertTextAtLine(
				editor,
				Math.max(0, cursor.line - 1),
				pos,
				timestamp
			);
			this.lastTimeStampInsertTimestamp = moment();
		});
	}

	onunload() {}

	async loadSettings() {
		this.settings = Object.assign(
			{},
			DEFAULT_SETTINGS,
			await this.loadData()
		);
	}

	async saveSettings() {
		await this.saveData(this.settings);
		// reset the last ts insert
		this.resetTimeStampInsertTimestamp();
	}

	async updateStatusText() {
		this.statusBarItemEl.setText(
			this.settings.tiditOn ? "tidit on" : "tidit off"
		);
	}
}

class TiditSettingTab extends PluginSettingTab {
	plugin: TiditPlugin;

	constructor(app: App, plugin: TiditPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;

		containerEl.empty();

		new Setting(containerEl)
			.setName("Tidit on/off")
			.setDesc(
				"Aside from disabling the plugin, you can use this setting to stop adding timestamps. Suggest binding to hotkey."
			)
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.tiditOn)
					.onChange(async (value) => {
						this.plugin.settings.tiditOn = value;
						this.plugin.updateStatusText();
						await this.plugin.saveSettings();
					})
			);

		const dateFormatSetting = new Setting(containerEl)
			.setName("Use timestamp format")
			.addMomentFormat((format: MomentFormatComponent) => {
				format
					.setDefaultFormat(DEFAULT_SETTINGS.timestampFormat)
					.setPlaceholder(`e.g. ${DEFAULT_SETTINGS.timestampFormat}`)
					.setValue(this.plugin.settings.timestampFormat)
					.onChange(async (value: string) => {
						if (value.trim().length === 0) {
							value = DEFAULT_SETTINGS.timestampFormat;
						}
						this.plugin.settings.timestampFormat = value;
						await this.plugin.saveSettings();
						// Update the sample element manually when the format changes
						if (sampleEl) {
							sampleEl.textContent = `Example: ${moment().format(
								value
							)}`;
						}
					});
			});
		const sampleContainer = dateFormatSetting.descEl.createDiv();
		const sampleEl: HTMLElement = sampleContainer.createSpan();
		sampleContainer.createEl("div");
		sampleEl.textContent = `Example: ${moment().format(
			this.plugin.settings.timestampFormat
		)}`;

		const refLink = dateFormatSetting.descEl.createEl("a", {
			href: "https://momentjs.com/docs/#/displaying/format/",
		});
		refLink.setText("See datetime format reference");
		const defaultEl = dateFormatSetting.descEl.createEl("span", {
			attr: { style: "display: block" },
		});
		defaultEl.setText(
			`Empty value will default to ${DEFAULT_SETTINGS.timestampFormat}`
		);

		new Setting(containerEl)
			.setName("Add timestamp after delay")
			.setDesc(
				"0 for every enter key, or positive integer for seconds after. Max is 1234 seconds"
			)
			.addText((text) =>
				text
					.setPlaceholder("0, or positive integer")
					.setValue(this.plugin.settings.addAfterDelay.toString())
					.onChange(async (value) => {
						const v = Math.max(
							Math.min(Number.parseInt(value), 1234)
						);
						this.plugin.settings.addAfterDelay = v;
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName("Insert new line after timestamp")
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.insertNewLineAfterTimestamp)
					.onChange(async (value) => {
						this.plugin.settings.insertNewLineAfterTimestamp =
							value;
					})
			);

		// Timezone setting - will use local time for now
		new Setting(containerEl)
			.setName("Timezone")
			.setDesc("Select timezone for timestamps")
			.addDropdown((dropdown) =>
				dropdown
					.addOption("local", "Local Time")
					.addOption("UTC", "UTC")
					// Add common timezones
					.addOption("America/New_York", "America/New_York")
					.addOption("America/Los_Angeles", "America/Los_Angeles")
					.addOption("America/Chicago", "America/Chicago")
					.addOption("America/Denver", "America/Denver")
					.addOption("Europe/London", "Europe/London")
					.addOption("Europe/Paris", "Europe/Paris")
					.addOption("Europe/Berlin", "Europe/Berlin")
					.addOption("Europe/Rome", "Europe/Rome")
					.addOption("Asia/Tokyo", "Asia/Tokyo")
					.addOption("Asia/Shanghai", "Asia/Shanghai")
					.addOption("Asia/Hong_Kong", "Asia/Hong_Kong")
					.addOption("Australia/Sydney", "Australia/Sydney")
					.addOption("Australia/Melbourne", "Australia/Melbourne")
					.addOption("Pacific/Auckland", "Pacific/Auckland")
					.setValue(this.plugin.settings.timezone)
					.onChange(async (value: string) => {
						this.plugin.settings.timezone = value;
						await this.plugin.saveSettings();
					})
			);

		// Manual timezone offset setting
		new Setting(containerEl)
			.setName("Use Manual Timezone Offset")
			.setDesc("Enable to use manual timezone offset")
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.useManualTimezoneOffset)
					.onChange(async (value) => {
						this.plugin.settings.useManualTimezoneOffset = value;
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName("Manual Timezone Offset")
			.setDesc("Set manual offset in minutes (e.g., -300 for UTC-5, 60 for UTC+1).")
			.addText((text) =>
				text
					.setPlaceholder("Enter offset in minutes")
					.setValue(this.plugin.settings.timezoneOffset.toString())
					.onChange(async (value) => {
						const offset = parseInt(value);
						if (!isNaN(offset)) {
							this.plugin.settings.timezoneOffset = offset;
							await this.plugin.saveSettings();
						}
					})
			);
	}
}
