import { execSync, spawn } from "child_process";
import path from "path";
import {
	type CancellationToken,
	type ExtensionContext,
	NotebookCell,
	NotebookCellData,
	NotebookCellKind,
	NotebookCellOutput,
	NotebookCellOutputItem,
	NotebookController,
	NotebookData,
	NotebookDocument,
	type NotebookSerializer,
	Terminal,
	notebooks,
	window,
	workspace,
} from "vscode";
import { SerializeBlock, parse, toMarkdown } from "./markdown";

const DEBUG = true;
const IsEmptyRegexp = /^\S*$/;

export const notebookType = "mdcf-notebook";
export const notebookId = "mdcf-kernel";
const notebookLabel = "Markdown Code Notebook";

export function activate(ctx: ExtensionContext) {
	ctx.subscriptions.push(
		workspace.registerNotebookSerializer(notebookType, new MySerializer(), {
			transientOutputs: true,
		}),
	);
	ctx.subscriptions.push(new MyNotebookController());
}

export function deactivate() {}

class MyNotebookController {
	readonly controllerId = notebookId;
	readonly notebookType = notebookType;
	public readonly supportsExecutionOrder = true;
	public readonly label = notebookLabel;
	public readonly supportedLanguages = [
		"typescript",
		"ts",
		"javascript",
		"js",
		"jsx",
		"tsx",
		"markdown",
		"mdx",
		"md",
		"shell",
		"shellscript",
		"bash",
		"sh",
	];
	private _controller: NotebookController;

	constructor() {
		this._controller = notebooks.createNotebookController(
			notebookId,
			notebookType,
			notebookLabel,
		);
		this._controller.supportedLanguages = this.supportedLanguages;
		this._controller.supportsExecutionOrder = true;
		this._controller.executeHandler = this.execute.bind(this);
	}

	private async execute(
		cells: NotebookCell[],
		_notebook: NotebookDocument,
		_controller: NotebookController,
	): Promise<void> {
		for (let cell of cells) {
			// console.log("[cell]", cell.document.languageId);
			if (
				cell.metadata.lang === "ts" ||
				cell.metadata.lang === "tsx" ||
				cell.document.languageId === "shell" ||
				cell.document.languageId === "shellscript"
			) {
				const exec = this._controller.createNotebookCellExecution(cell);
				exec.start(Date.now());
				try {
					// const pre = `source ${process.env.HOME}/.config/fish/config.fish\n`;
					// const pre = "";
					const shellCmd = cell.document.getText().replace(/^\$\s*/gmu, "");
					const uri = cell.document.uri;
					let stdout = "";
					let stderr = "";

					for (const cmd of shellCmd.split(/\n/)) {
						// window.termin
						// const term = window.createTerminal({
						// 	name: `mdcf: ${path.basename(uri.fsPath)}`,
						// 	cwd: path.dirname(uri.fsPath),
						// });
						// // term.
						// term.sendText(shellCode, true);
						// term.show(true);

						// const HOME = process.env.HOME;
						// console.log("HOME", process.env.HOME);
						// console.log("PATH", process.env.PATH);
						await new Promise<string>((resolve, reject) => {
							// const args = shellCmd.split(/\s+/);

							// const cmd = args.shift() as string;
							// console.log("cmd", cmd, args);
							const [first, ...rest] = cmd.split(/\s+/);
							const proc = spawn(first, rest, {
								// shell: "/Users/kotaro.chikuba/brew/bin/fish",
								cwd: path.dirname(uri.fsPath),
								env: {
									...process.env,
									PATH:
										process.env.PATH +
										":/Users/kotaro.chikuba/.local/share/nvm/v18.14.2/bin/",
									HOME: process.env.HOME,
									__mdcf: "1",
								},
							});
							proc.on("error", (err) => {
								console.error("proc:error", err);
								reject(err);
							});
							proc.on("close", (code) => {
								console.log("proc:close", code);
								resolve(stdout);
							});
							proc.stdout.on("data", (data) => {
								console.log("proc:stdout", data.toString("utf-8"));
								stdout += data.toString("utf-8");
								exec.replaceOutput(
									new NotebookCellOutput([
										NotebookCellOutputItem.text(data, "text/plain"),
									]),
								);
							});

							proc.stderr.on("data", (data) => {
								console.log("proc:stdout", data.toString("utf-8"));
								stdout += data.toString("utf-8");
								exec.replaceOutput(
									new NotebookCellOutput([
										NotebookCellOutputItem.text(data, "text/plain"),
									]),
								);
							});
						});
					}

					// exec.replaceOutput(
					// 	new NotebookCellOutput([
					// 		NotebookCellOutputItem.text(output, "text/plain"),
					// 	]),
					// );
					exec.end(true, Date.now());
				} catch (err) {
					console.error("shellscript error", err);
					exec.end(false);
				}
			}
			if (
				cell.document.languageId === "typescript" ||
				cell.document.languageId === "typescriptreact"
			) {
				const exec = this._controller.createNotebookCellExecution(cell);
				exec.start(Date.now());
				try {
					const code = cell.document.getText();
					const tempId = Math.random().toString(36).slice(2);
					const intro = `
				const original = {...console};
				globalThis.__ctx = {
					original,
					logs: [],
				};
				function createLogHandler(type) {
					return (...args) => {
						original[type](...args);
						globalThis.__ctx?.logs.push([type, args]);
					}
				};
				const patched = {
					log: createLogHandler('log'),
					warn: createLogHandler('warn'),
					error: createLogHandler('error'),
					info: createLogHandler('info'),
					debug: createLogHandler('debug'),
					table: createLogHandler('table'),
					clear: createLogHandler('clear'),
					time: createLogHandler('time'),
					timeEnd: createLogHandler('timeEnd'),
				};
				globalThis.console = original !== globalThis.console ? patched : globalThis.console;
				export const __backdoor = () => {
					return globalThis.__ctx.logs;
				}
				export const __restore = () => {
					delete globalThis.__ctx;
					globalThis.console = original;
				};
				// run: ${tempId};
				`;
					const encoded = btoa(unescape(encodeURIComponent(intro + code)));
					// @ts-ignore
					delete globalThis.__ctx;

					const mod = await import(`data:text/javascript;base64,${encoded}`);

					const logs = mod?.__backdoor?.();
					let out = "";
					for (const [type, args] of logs) {
						out += `[console:${type}] ${args
							.map((a: any) => toView(a))
							.join(" ")}\n`;
					}
					for (const exportedKey of Object.keys(mod)) {
						if (exportedKey.startsWith("__")) continue;
						out += `[export:${exportedKey}] ${
							toView(mod[exportedKey]) as any
						}\n`;
					}
					exec.replaceOutput(
						new NotebookCellOutput([
							NotebookCellOutputItem.text(out, "text/plain"),
						]),
					);
					// console.log("ret", logs, mod);
					exec.end(true, Date.now());
					console.log("executed:success", cell.document.getText());
					mod.__restore?.();
					// @ts-ignore
					delete globalThis.__ctx;
				} catch (e) {
					console.error("eval error", e);
					exec.end(false);
					console.log("executed:fail", cell.document.getText());
				}
			}
		}
	}

	dispose(): void {
		this._controller.dispose();
	}
}

function toView(input: any) {
	if (typeof input === "object") {
		return JSON.stringify(input, null, 2);
	}
	if (
		typeof input === "string" ||
		typeof input === "number" ||
		typeof input === "boolean" ||
		typeof input === "undefined" ||
		typeof input === "bigint" ||
		typeof input === "symbol"
	) {
		return input?.valueOf?.() ?? input;
	}
	return JSON.stringify(input, null, 2);
}

class MySerializer implements NotebookSerializer {
	public label = notebookLabel;
	async serializeNotebook(
		data: NotebookData,
		_token: CancellationToken,
	): Promise<Uint8Array> {
		DEBUG && console.log("serializeNotebook", data);
		const blocks: SerializeBlock[] = data.cells.map((cell) => {
			if (cell.metadata) {
				return {
					...cell.metadata,
					content: cell.value,
				} as SerializeBlock;
			}
			if (cell.kind === NotebookCellKind.Markup) {
				return {
					type: "markdown",
					content: cell.value + "\n",
				};
			}
			const lang = cell.languageId;
			return {
				type: "code",
				content: cell.value,
				fenceStart: `\`\`\`${lang}\n`,
				fenceEnd: "```\n",
			};
		});
		const raw = toMarkdown(blocks);
		return new TextEncoder().encode(raw);
	}
	async deserializeNotebook(
		context: Uint8Array,
		_token: CancellationToken,
	): Promise<NotebookData> {
		const raw = new TextDecoder().decode(context);
		DEBUG && console.log("deserializeNotebook", raw);
		const blocks = parse(raw);
		const cells = blocks.map((block) => {
			if (block.type === "markdown") {
				const cell = new NotebookCellData(
					NotebookCellKind.Markup,
					block.content,
					"markdown",
				);
				cell.metadata = block;
				return cell;
			}
			const lang = block.lang ? langToLanguageId(block.lang) : "plaintext";
			console.log("[lang]", lang, block.lang);
			const cell = new NotebookCellData(
				NotebookCellKind.Code,
				block.content,
				lang,
			);
			cell.executionSummary = {
				executionOrder: block.index,
			};
			cell.metadata = block;
			// @ts-ignore
			// cell.metadata.runnable = true;
			return cell;
		});

		const filteredCell = cells.filter((cell) => {
			return !IsEmptyRegexp.test(cell.value);
		});
		return new NotebookData(filteredCell);
	}
}

function langToLanguageId(lang: string) {
	// languages.getLanguages().then((langs) => {
	// 	console.log("langs", langs);
	// });
	if (lang === "ts") return "typescriptreact";
	if (lang === "tsx") return "typescriptreact";
	if (lang === "js") return "javascript";
	if (lang === "md") return "markdown";
	if (lang === "bash") return "shell";
	if (lang === "sh") return "shell";
	if (lang === "shellscript") return "shellscript";
	return lang;
}
