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
class GraphicalFilterControl { //extends HTMLElement {
	public static readonly defaultPresets: { [name: string]: string } = {
		"Powerful": "oaGhoaGhoaGhoaGhoaGhoaGhoaGhoaGhoaGhoaGhoaGhoaGhoaGhoaGhoaGhoaGhoaGhoaGhoaGhoaGhoaGhoaGhoaGhoaGhoaGhoaGhoaGhoaGhoaGhoaGhoaGhoaGhoaGhoaGhoaGhoaGhoaGhoaGhoaGhoaGhoaGgoKCgoKCgoKCfn5+fn5+enp6enp2dnZ2cnJybm5qampqZmZmYmJiXl5eWlpWVlZSUlJOTkpKSkZGRkZCQkI+Pj46Ojo6NjY2NjYyMjIyLi4uLi4uKioqKioqKioqKiYmJiYmJiYmJiYmJiYmJiYmJiYmJiYmJiYmJiYmJiYmJiYmJiYmJiYmJiYmJiYmJiYmJiYmJiYmJiYmJiYmJiYmJiYmJiYmJiYmJiYmJiYmJiYmJiYmJiYmJiYmJiYmJiYmJiYmJiYmJiYmJiYmJiYmJiYmJiYmJiYmJiYmJiYmJiYmJiYmJiYmJiYmJiYmJiYmJiYmJiYmJiYmJiYmJiYmJiYmKioqKioqKioqKioqKiouLi4uLjIyMjIyNjY2Njo6Ojo+Pj4+QkJCRkpKSk5OTk5SUlJWVlZWWlpaXl5eXmJiYmZmZmZqampqbm5ubnJycnJ2dnZ2enp6enp+fn5+fn6CgoKCgoKCgoKGhoaGhoaGhoaGhoaGhoaE="
	};

	public filterChangedCallback: FilterChangedCallback | null;
	public editor: GraphicalFilterEditorControl;

	private _enabled: boolean;

	constructor(editorElement: HTMLDivElement, audioContext: AudioContext, enabled?: boolean) {
		//super();

		//const shadowRoot = this.attachShadow({ mode: "open" }),
		//	editorElement = document.createElement("div"),
		//	style = document.createElement("link");

		//style.setAttribute("rel", "stylesheet");
		//style.setAttribute("type", "text/css");
		//style.setAttribute("href", "assets/css/graphicalFilterEditor.css");
		//shadowRoot.appendChild(style);
		//shadowRoot.appendChild(editorElement);

		this.filterChangedCallback = null;
		this._enabled = !!enabled;
		this.editor = new GraphicalFilterEditorControl(editorElement, 2048, audioContext, this.filterChanged.bind(this), InternalStorage.loadGraphicalFilterEditorSettings(), {
			svgRenderer: true,

			radioHTML: Icon.createHTML("icon-radio", false, "menu-icon"),
			checkHTML: Icon.createHTML("icon-check", false, "menu-icon"),

			menuWidth: Icon.outerSizeREM + "rem",
			menuPadding: "0",
			openMenuHTML: Icon.createHTML("icon-expand-less", true),
			closeMenuHTML: Icon.createHTML("icon-expand-more", true)
		});
	}

	private filterChanged(): void {
		if (this.filterChangedCallback)
			this.filterChangedCallback();
	}

	public get enabled(): boolean {
		return this._enabled;
	}

	public set enabled(enabled: boolean) {
		if (this._enabled === enabled)
			return;

		this._enabled = enabled;

		if (this.filterChangedCallback && this.editor && this.editor.filter)
			this.filterChangedCallback();
	}

	public saveSettings(): void {
		if (this.editor)
			InternalStorage.saveGraphicalFilterEditorSettings(this.editor.saveSettings());
	}
}

//customElements.define("graphical-filter-control", GraphicalFilterControl);
