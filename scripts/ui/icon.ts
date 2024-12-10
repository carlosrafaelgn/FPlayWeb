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

class Icon extends HTMLElement {
	public static readonly disabledFeatures = ["shadow"];
	public static readonly observedAttributes = ["name", "color", "large", "sr-title"];

	public static readonly baseSizePX = 12;

	public static createHTML(name: string, color?: string | null, large?: boolean, className?: string | null, id?: string | null, srTitle?: string | null): string {
		return `<f-icon name="${name}"${color ? (' color="' + color + '"') : ''}${large ? (' large') : ''}${className ? (' class="' + className + '"') : ''}${id ? (' id="' + id + '"') : ''}${srTitle ? (' sr-title="' + srTitle + '"') : ""} />`;
	}

	public static create(name: string, color?: string | null, large?: boolean, className?: string | null, id?: string | null, srTitle?: string | null): Icon {
		const icon = document.createElement("f-icon") as Icon;

		icon.name = name;

		if (color)
			icon.color = color;

		if (large)
			icon.large = large;

		if (className)
			icon.className = className;

		if (id)
			icon.id = id;

		if (srTitle)
			icon.srTitle = srTitle;

		return icon;
	}

	private _name: string | null;
	private _color: string | null;
	private _large: boolean;
	private _srTitle: string | null;
	private _srTitleElement: HTMLSpanElement | null;
	private _svg: SVGSVGElement | null;
	private _use: SVGUseElement | null;

	public constructor() {
		super();

		this._name = null;
		this._color = null;
		this._large = false;
		this._srTitle = null;
		this._srTitleElement = null;
		this._svg = null;
		this._use = null;
	}

	public get name(): string | null {
		return this._name;
	}

	public set name(name: string | null) {
		if (name !== null)
			this.setAttribute("name", name);
		else
			this.removeAttribute("name");
	}

	public get color(): string | null {
		return this._color;
	}

	public set color(color: string | null) {
		if (color !== null)
			this.setAttribute("color", color);
		else
			this.removeAttribute("color");
	}

	public get large(): boolean {
		return this._large;
	}

	public set large(large: boolean) {
		if (large)
			this.setAttribute("large", "");
		else
			this.removeAttribute("large");
	}

	public get srTitle(): string | null {
		return this._srTitle;
	}

	public set srTitle(srTitle: string | null) {
		if (srTitle !== null)
			this.setAttribute("sr-title", srTitle);
		else
			this.removeAttribute("sr-title");
	}

	public connectedCallback(): void {
		if (this._use)
			return;

		this._svg = document.createElementNS("http://www.w3.org/2000/svg", "svg"),
		this._use = document.createElementNS("http://www.w3.org/2000/svg", "use");
		this._svg.ariaHidden = "true";
		this._svg.appendChild(this._use);

		const name = this._name;
		if (name) {
			this._name = null;
			this.attributeChangedCallback("name", null, name);
		}

		const color = this._color;
		if (color) {
			this._color = null;
			this.attributeChangedCallback("color", null, color);
		}

		this._large	 = !this._large;
		this.attributeChangedCallback("large", null, this._large ? null : "");

		const srTitle = this._srTitle;
		if (srTitle) {
			this._srTitle = null;
			this.attributeChangedCallback("sr-title", null, srTitle);
		}

		this.appendChild(this._svg);
	}

	public attributeChangedCallback(name: string, oldValue: string | null, newValue: string | null): void {
		const use = this._use;

		switch (name) {
			case "name":
				if (this._name === newValue)
					return;

				this._name = newValue;

				if (!use)
					return;

				use.setAttribute("href", "#" + newValue);
				break;

			case "color":
				if (this._color === newValue)
					return;

				if (!use) {
					this._color = newValue;
					return;
				}

				if (this._color)
					this.classList.remove(this._color);

				this._color = newValue;

				if (newValue)
					this.classList.add(newValue);
				break;

			case "large":
				const large = (newValue !== null);

				if (this._large === large)
					return;

				if (!use) {
					this._large = large;
					return;
				}

				if (this._large)
					this.classList.remove("large");

				this._large = large;

				if (large)
					this.classList.add("large");
				break;

			case "sr-title":
				if (this._srTitle === newValue)
					return;

				this._srTitle = newValue;

				if (!use)
					return;

				if (!newValue) {
					if (this._srTitleElement) {
						this.removeChild(this._srTitleElement);
						this._srTitleElement = null;
					}
				} else {
					if (!this._srTitleElement) {
						this._srTitleElement = Strings.createSrOnlyText(newValue);
						this.insertAdjacentElement("afterbegin", this._srTitleElement);
					} else {
						Strings.changeText(this._srTitleElement, newValue);
					}
				}
				break;
		}
	}
}

customElements.define("f-icon", Icon);
