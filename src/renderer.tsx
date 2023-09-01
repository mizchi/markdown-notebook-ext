// import {} from "vscode";
export const activate = () => {
	console.log("activated");
	async function renderOutputItem(item: any, element: HTMLElement) {
		console.log("render");
		element.innerHTML = `
		<div class="messages" style="visibility: hidden;"></div>
		<div class="progress">
			<div>
				xxx
			</div>
		</div>
		`;

		// try {
		// 	const parser = new Parser(element, { keepContent: true });
		// 	await parser.parse(item.text());

		// 	// unset flags, rendered in status bar
		// 	parser.parsed.flags = [];

		// 	await parser.render();

		// } catch (err) {
		// 	console.error(err);
		// 	element.innerText = String(err);
		// }
	}
	return { renderOutputItem };
};

console.log("started");

// append base element
// <script type="text/html" id="svg-container-base"></script>
const containerBase = document.createElement("script");
document.head.appendChild(containerBase);
// containerBase.type = "text/html";
// containerBase.id = "svg-container-base";

const style = document.createElement("style");
document.head.appendChild(style);
