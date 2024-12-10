//
// MIT License
//
// Copyright (c) 2021 Carlos Rafael Gimenes das Neves
//
// Permission is hereby granted, free of charge, to any person obtaining a copy
// of this software and associated documentation files (the "Software"), to deal
// in the Software without restriction, including without limitation the rights
// to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
// copies of the Software, and to permit persons to whom the Software is
// furnished to do so, subject to the following conditions:
//
// The above copyright notice and this permission notice shall be included in all
// copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
// IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
// FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
// AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
// LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
// OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
// SOFTWARE.
//
// https://github.com/carlosrafaelgn/FPlayWeb
//

// Fewer browsers support custom elements / shadow DOM than Web Audio
// https://caniuse.com/mdn-api_window_customelements
// https://caniuse.com/mdn-api_element_attachshadow
class GraphicalFilterControl extends ConnectableNode { //extends HTMLElement {
	public static readonly defaultPresets: { [name: string]: string } = {
		"Powerful": "oaGhoaGhoaGhoaGhoaGhoaGhoaGhoaGhoaGhoaGhoaGhoaGhoaGhoaGhoaGhoaGhoaGhoaGhoaGhoaGhoaGhoaGhoaGhoaGhoaGhoaGhoaGhoaGhoaGhoaGhoaGhoaGhoaGhoaGhoaGhoaGhoaGhoaGhoaGhoaGhoaGgoKCgoKCgoKCfn5+fn5+enp6enp2dnZ2cnJybm5qampqZmZmYmJiXl5eWlpWVlZSUlJOTkpKSkZGRkZCQkI+Pj46Ojo6NjY2NjYyMjIyLi4uLi4uKioqKioqKioqKiYmJiYmJiYmJiYmJiYmJiYmJiYmJiYmJiYmJiYmJiYmJiYmJiYmJiYmJiYmJiYmJiYmJiYmJiYmJiYmJiYmJiYmJiYmJiYmJiYmJiYmJiYmJiYmJiYmJiYmJiYmJiYmJiYmJiYmJiYmJiYmJiYmJiYmJiYmJiYmJiYmJiYmJiYmJiYmJiYmJiYmJiYmJiYmJiYmJiYmJiYmJiYmJiYmJiYmJiYmKioqKioqKioqKioqKiouLi4uLjIyMjIyNjY2Njo6Ojo+Pj4+QkJCRkpKSk5OTk5SUlJWVlZWWlpaXl5eXmJiYmZmZmZqampqbm5ubnJycnJ2dnZ2enp6enp+fn5+fn6CgoKCgoKCgoKGhoaGhoaGhoaGhoaGhoaE="
	};

	private static readonly _simpleModeMinWidth = "280px";
	private static readonly _advancedModeMinWidth = "512px";

	private readonly _container: HTMLDivElement;
	private readonly _outerContainer: HTMLDivElement;
	private readonly _simpleEditor: SimpleFilterEditorControl;
	public readonly editor: GraphicalFilterEditorControl;

	private _simpleMode: boolean;

	public constructor(container: HTMLDivElement, outerContainer: HTMLDivElement, audioContext: AudioContext, simpleMode?: boolean) {
		super();

		//const shadowRoot = this.attachShadow({ mode: "open" }),
		//	editorElement = document.createElement("div"),
		//	style = document.createElement("link");

		//style.rel = "stylesheet";
		//style.type = "text/css";
		//style.href = "assets/css/graphicalFilterEditor.css";
		//shadowRoot.appendChild(style);
		//shadowRoot.appendChild(editorElement);

		this._simpleMode = !!simpleMode;

		this._container = container;
		this._outerContainer = outerContainer;

		let element = document.createElement("div");
		if (!this._simpleMode) {
			outerContainer.style.minWidth = GraphicalFilterControl._advancedModeMinWidth;
			container.appendChild(element);
		}

		const graphicalFilterEditorSettings = InternalStorage.loadGraphicalFilterEditorSettings();
		if (this._simpleMode)
			graphicalFilterEditorSettings.editMode = GraphicalFilterEditorControl.editModeShelfEq;

		this.editor = new GraphicalFilterEditorControl(element, 2048, audioContext, this.filterChanged.bind(this), graphicalFilterEditorSettings, {
			svgRenderer: true,
			fontSize: AppUI.smallFontSizeREM + "rem",
			lineHeight: AppUI.smallContentsSizeREM + "rem",

			radioHTML: Icon.createHTML("icon-radio", null, false, "menu-icon"),
			checkHTML: Icon.createHTML("icon-check", null, false, "menu-icon"),

			openMenuHTML: `<span>${Icon.createHTML("icon-expand-less", null, true)}</span>`,
			closeMenuHTML: `<span>${Icon.createHTML("icon-expand-more", null, true)}</span>`
		});

		element = document.createElement("div");
		element.className = "button-bottom-margin";
		if (this._simpleMode) {
			outerContainer.style.minWidth = GraphicalFilterControl._simpleModeMinWidth;
			container.appendChild(element);
		}
		this._simpleEditor = new SimpleFilterEditorControl(element, this.editor);

		const labels = this.editor.element.querySelectorAll("div.GELBL");
		for (let i = labels.length - 1; i >= 0; i--) {
			const label = labels[i] as HTMLDivElement;
			label.style.height = "var(--button-size)";
			label.style.fontSize = AppUI.smallFontSizeREM + "rem";
			label.style.lineHeight = AppUI.contentsSizeREM + "rem";
			label.style.paddingTop = "var(--button-padding)";
			label.style.paddingBottom = "0";
		}

		const menuButton = this.editor.element.querySelector("div.GEBTN.GECLK") as HTMLDivElement;
		menuButton.className = "btn square white transparent";
		menuButton.style.width = "";
		menuButton.style.padding = "";
		menuButton.style.float = "right";
	}

	protected get input(): AudioNode | null {
		return this.editor.filter.inputNode;
	}

	protected get output(): AudioNode | null {
		return this.editor.filter.outputNode;
	}

	private filterChanged(): void {
		if (this.enabled)
			this.nodesChanged();
	}

	public get simpleMode(): boolean {
		return this._simpleMode;
	}

	public set simpleMode(simpleMode: boolean) {
		if (this._simpleMode === simpleMode)
			return;

		this._simpleMode = simpleMode;

		let remove: HTMLElement | null = null;
		let add: HTMLElement | null = null;

		if (simpleMode) {
			this._outerContainer.style.minWidth = GraphicalFilterControl._simpleModeMinWidth;
			this.editor.editMode = GraphicalFilterEditorControl.editModeShelfEq;
			this._simpleEditor.updateSliders();
			remove = this.editor.element;
			add = this._simpleEditor.element;
		} else {
			this._outerContainer.style.minWidth = GraphicalFilterControl._advancedModeMinWidth;
			remove = this._simpleEditor.element;
			add = this.editor.element;
		}

		if (remove && remove.parentNode)
			remove.parentNode.removeChild(remove);

		if (this._container && add && !add.parentNode)
			this._container.appendChild(add);

		this.filterChanged();
	}

	public saveSettings(): void {
		if (this.editor)
			InternalStorage.saveGraphicalFilterEditorSettings(this.editor.saveSettings());
	}
}

//customElements.define("graphical-filter-control", GraphicalFilterControl);
