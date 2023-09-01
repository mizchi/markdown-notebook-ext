// import { langToExtMap } from "./constants.mjs";
// import path from 'path';

const regex = new RegExp(
	/```(?<type>[^\n]*)?\n(?<content>[.\s\S\n]*?)\n```/gmu,
);
type Range = [from: number, to: number];

export type CodeBlock = {
	type: "code";
	blockRange: Range;
	codeRange: Range;
	content: string;
	fileName: string | undefined;
	lang: string | undefined;
	index: number;
};

export type MarkdownCodeBlock = {
	type: "code";
	blockRange: Range;
	codeRange: Range;
	content: string;
	fileName: string | undefined;
	lang: string | undefined;
	index: number;
	fenceStart: string;
	fenceEnd: string;
};

type MarkdownBlock = {
	type: "markdown";
	range: Range;
	content: string;
	index: number;
	// fenceStart: string;
	// fenceEnd: string;
};

export function extractCodeBlocks(text: string) {
	const blocks: Array<CodeBlock> = [];
	for (const match of text.matchAll(regex)) {
		const { content, type } = match.groups! as {
			content: string;
			type?: string;
		};
		const start = match.index!;
		const end = start + Array.from(match[0]).length;
		const codeStart = start + 3 + (type ? Array.from(type).length : 0) + 1;
		const codeEnd = codeStart + Array.from(content).length;
		const [lang, fileName] = type?.split(":") ?? [undefined, undefined];
		blocks.push({
			type: "code",
			blockRange: [start, end],
			codeRange: [codeStart, codeEnd],
			lang,
			content,
			fileName,
			index: blocks.length,
		});
	}
	return blocks;
}

export type SerializeBlock =
	| {
			type: "code";
			content: string;
			fenceStart: string;
			fenceEnd: string;
	  }
	| {
			type: "markdown";
			content: string;
	  };

export function toMarkdown(blocks: Array<SerializeBlock>) {
	return blocks
		.map((block) => {
			if (block.type === "markdown") {
				return block.content;
			}
			if (block.type === "code") {
				return `${block.fenceStart}${block.content}${block.fenceEnd}`;
			}
		})
		.join("");
}

export function parse(text: string) {
	const blocks: Array<MarkdownCodeBlock | MarkdownBlock> = [];
	let offset = 0;

	for (const match of text.matchAll(regex)) {
		const { content, type } = match.groups! as {
			content: string;
			type?: string;
		};
		const start = match.index!;
		const end = start + Array.from(match[0]).length;
		const codeStart = start + 3 + (type ? Array.from(type).length : 0) + 1;
		const codeEnd = codeStart + Array.from(content).length;
		const [lang, fileName] = type?.split(":") ?? [undefined, undefined];
		// add
		blocks.push(
			// markdown
			{
				type: "markdown",
				range: [offset, start],
				content: text.slice(offset, start),
				index: blocks.length,
			} satisfies MarkdownBlock,
		);
		blocks.push({
			type: "code",
			blockRange: [start, end],
			codeRange: [codeStart, codeEnd],
			lang,
			content,
			fileName,
			index: blocks.length,
			fenceStart: text.slice(start, codeStart),
			fenceEnd: text.slice(codeEnd, end),
		} satisfies MarkdownCodeBlock);
		offset = end;
	}
	// push last markdown
	blocks.push({
		type: "markdown",
		range: [offset, text.length],
		content: text.slice(offset),
		index: blocks.length,
		fenceStart: "",
		fenceEnd: "",
	} as MarkdownBlock);
	return blocks;
}

// export function getVirtualFileName(block: CodeBlock) {
//   const ext = langToExtMap[block.lang ?? ""] ?? ".txt";
//   if (block.fileName) {
//     return block.fileName.endsWith(ext) ? block.fileName : `${block.fileName}${ext}`;
//   }
//   return `${block.index}${ext}`;
// }
