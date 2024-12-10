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

interface CommonButtonControlOptions {
	id?: string | null;
	iconName?: string | null;
	text?: string | null;
	color?: string | null;
	square?: boolean | null;
	opaque?: boolean | null;
	unfocusable?: boolean | null;
	checkable?: boolean | null;
	checked?: boolean | null;
	checkbox0Color?: string | null;
	checkbox1Color?: string | null;
	className?: string | null;
}

interface ButtonControlOptions extends CommonButtonControlOptions {
	parent?: HTMLElement | null;
	onclick?: (() => void) | null;
}

class ButtonControl extends HTMLElement {
	private static readonly iconCheckName0 = "icon-checkbox-0";
	private static readonly iconCheckName1 = "icon-checkbox-1";
	private static readonly iconCheckColor0 = null;
	private static readonly iconCheckColor1 = "orange";

	public static readonly disabledFeatures = ["shadow"];
	public static readonly observedAttributes = ["disabled", "unfocusable", "color", "square", "opaque", "checkable", "checked", "checkbox0-color", "checkbox1-color", "icon-name", "text"];

	public static create(options: CommonButtonControlOptions | ButtonControlOptions, skipClickAndAppend?: boolean): ButtonControl {
		const button = document.createElement("f-button") as ButtonControl;

		if (options.id)
			button.id = options.id;

		if (options.className)
			button.className = options.className;

		if (options.square)
			button.square = true;

		if (options.opaque)
			button.opaque = true;

		if (options.unfocusable)
			button.unfocusable = true;

		if (options.checkbox0Color)
			button.checkbox0Color = options.checkbox0Color;

		if (options.checkbox1Color)
			button.checkbox1Color = options.checkbox1Color;

		if (options.checked)
			button.checked = true;

		if (options.checkable)
			button.checkable = true;

		if (options.color)
			button.color = options.color;

		if (options.iconName)
			button.iconName = options.iconName;

		if (options.text)
			button.text = options.text;

		if (!skipClickAndAppend) {
			const o = options as ButtonControlOptions;

			if (o.onclick)
				button.onclick = o.onclick;

			if (o.parent)
				o.parent.appendChild(button);
		}

		return button;
	}

	private _defaultFocusElement: HTMLSpanElement | null;
	private _disabled: boolean;
	private _unfocusable: boolean;
	private _color: string | null;
	private _square: boolean;
	private _opaque: boolean;
	private _checkable: boolean;
	private _checked: boolean;
	private _checkbox0Color: string | null;
	private _checkbox1Color: string | null;
	private _iconCheck: Icon | null;
	private _icon: Icon | null;
	private _text: string | null;
	private _textNode: Text | null;

	private readonly _boundClick: any;
	private readonly _boundKeyDown: any;

	public constructor() {
		super();

		this._defaultFocusElement = null;
		this._disabled = false;
		this._unfocusable = false;
		this._color = null;
		this._square = false;
		this._opaque = false;
		this._checkable = false;
		this._checked = false;
		this._checkbox0Color = null;
		this._checkbox1Color = null;
		this._iconCheck = null;
		this._icon = null;
		this._text = null;
		this._textNode = null;

		this._boundClick = this.elementClick.bind(this);
		this._boundKeyDown = this.elementKeyDown.bind(this);
	}

	public get defaultFocusElement(): HTMLElement {
		return this._defaultFocusElement || this;
	}

	public get disabled(): boolean {
		return this._disabled;
	}

	public set disabled(disabled: boolean) {
		if (disabled)
			this.setAttribute("disabled", "");
		else
			this.removeAttribute("disabled");
	}

	public get unfocusable(): boolean {
		return this._unfocusable;
	}

	public set unfocusable(unfocusable: boolean) {
		if (unfocusable)
			this.setAttribute("unfocusable", "");
		else
			this.removeAttribute("unfocusable");
	}

	public get color(): string | null {
		return this._color;
	}

	public set color(color: string | null) {
		if (color)
			this.setAttribute("color", color);
		else
			this.removeAttribute("color");
	}

	public get square(): boolean {
		return this._square;
	}

	public set square(square: boolean) {
		if (square)
			this.setAttribute("square", "");
		else
			this.removeAttribute("square");
	}

	public get opaque(): boolean {
		return this._opaque;
	}

	public set opaque(opaque: boolean) {
		if (opaque)
			this.setAttribute("opaque", "");
		else
			this.removeAttribute("opaque");
	}

	public get checkable(): boolean {
		return this._checkable;
	}

	public set checkable(checkable: boolean) {
		if (checkable)
			this.setAttribute("checkable", "");
		else
			this.removeAttribute("checkable");
	}

	public get checked(): boolean {
		return this._checked;
	}

	public set checked(checked: boolean) {
		if (checked)
			this.setAttribute("checked", "");
		else
			this.removeAttribute("checked");
	}

	public get checkbox0Color(): string | null {
		return this._checkbox0Color;
	}

	public set checkbox0Color(checkbox0Color: string | null) {
		if (checkbox0Color)
			this.setAttribute("checkbox0-color", checkbox0Color);
		else
			this.removeAttribute("checkbox0-color");
	}

	public get checkbox1Color(): string | null {
		return this._checkbox1Color;
	}

	public set checkbox1Color(checkbox1Color: string | null) {
		if (checkbox1Color)
			this.setAttribute("checkbox1-color", checkbox1Color);
		else
			this.removeAttribute("checkbox1-color");
	}

	public get iconName(): string | null {
		return (this._icon && this._icon.name);
	}

	public set iconName(iconName: string | null) {
		if (iconName)
			this.setAttribute("icon-name", iconName);
		else
			this.removeAttribute("icon-name");
	}

	public get text(): string | null {
		return this._text;
	}

	public set text(text: string | null) {
		if (text)
			this.setAttribute("text", text);
		else
			this.removeAttribute("text");
	}

	private elementClick(e: MouseEvent): any {
		if (!this._disabled)
			this.checked = !this._checked;
	}

	private elementKeyDown(e: KeyboardEvent): any {
		if (this._disabled || e.ctrlKey || e.metaKey || e.shiftKey || e.altKey || e.repeat || !(e.key === "Enter" || e.key === " "))
			return;

		cancelEvent(e);

		this.click();

		return false;
	}

	public connectedCallback(): void {
		if (this._defaultFocusElement)
			return;

		this.role = "button";
		this.classList.add("btn");

		const defaultFocusElement = document.createElement("span");
		this._defaultFocusElement = defaultFocusElement;
		//defaultFocusElement.ariaHidden = "true";
		defaultFocusElement.tabIndex = -1;

		this._disabled = !this._disabled;
		this.attributeChangedCallback("disabled", null, this._disabled ? null : "");

		this._unfocusable = !this._unfocusable;
		this.attributeChangedCallback("unfocusable", null, this._unfocusable ? null : "");

		if (this._icon)
			defaultFocusElement.appendChild(this._icon);

		const color = this._color;
		if (color) {
			this._color = null;
			this.attributeChangedCallback("color", null, color);
		}

		this._square = !this._square;
		this.attributeChangedCallback("square", null, this._square ? null : "");

		this._opaque = !this._opaque;
		this.attributeChangedCallback("opaque", null, this._opaque ? null : "");

		if (this._checkable) {
			this._checkable = !this._checkable;
			this.attributeChangedCallback("checkable", null, this._checkable ? null : "");
		}

		this.appendChild(defaultFocusElement);
	}

	public attributeChangedCallback(name: string, oldValue: string | null, newValue: string | null): void {
		const defaultFocusElement = this._defaultFocusElement;

		switch (name) {
			case "disabled":
				const disabled = (newValue !== null);

				if (this._disabled === disabled)
					return;

				this._disabled = disabled;

				if (!defaultFocusElement)
					return;

				if (disabled)
					this.removeAttribute("tabindex");
				else if (!this._unfocusable)
					this.tabIndex = 0;

				if (disabled)
					this.classList.add("disabled");
				else
					this.classList.remove("disabled");
				break;

			case "unfocusable":
				const unfocusable = (newValue !== null);

				if (this._unfocusable === unfocusable)
					return;

				this._unfocusable = unfocusable;

				if (!defaultFocusElement)
					return;

				if (unfocusable) {
					this.removeAttribute("tabindex");
					this.removeEventListener("keydown", this._boundKeyDown);
				} else {
					if (!this._disabled)
						this.tabIndex = 0;
					this.addEventListener("keydown", this._boundKeyDown);
				}
				break;

			case "color":
				if (this._color === newValue)
					return;

				if (!defaultFocusElement) {
					this._color = newValue;
					return;
				}

				if (this._icon)
					this._icon.color = newValue;

				if (this._color)
					this.classList.remove(this._color);

				this._color = newValue;

				if (newValue)
					this.classList.add(newValue);
				break;

			case "square":
				const square = (newValue !== null);

				if (this._square === square)
					return;

				this._square = square;

				if (!defaultFocusElement)
					return;

				if (square) {
					if (this._iconCheck)
						this._iconCheck.classList.remove("margin");
					if (this._icon)
						this._icon.classList.remove("margin");
					this.classList.add("square");
				} else {
					if (this._iconCheck)
						this._iconCheck.classList.add("margin");
					if (this._icon)
						this._icon.classList.add("margin");
					this.classList.remove("square");
				}

				const text = this._text;
				if (text) {
					this._text = null;
					this.attributeChangedCallback("text", null, text);
				}
				break;

			case "opaque":
				const opaque = (newValue !== null);

				if (this._opaque === opaque)
					return;

				this._opaque = opaque;

				if (!defaultFocusElement)
					return;

				if (opaque)
					this.classList.remove("transparent");
				else
					this.classList.add("transparent");
				break;

			case "checkable":
				const checkable = (newValue !== null);

				if (this._checkable === checkable)
					return;

				this._checkable = checkable;

				if (!defaultFocusElement)
					return;

				if (checkable) {
					this.addEventListener("click", this._boundClick, { capture: true });
					this.role = "checkbox";
					this.ariaChecked = (this._checked ? "true" : "false");
					this._iconCheck = Icon.create(this._checked ? ButtonControl.iconCheckName1 : ButtonControl.iconCheckName0, this._checked ? (this._checkbox1Color || ButtonControl.iconCheckColor1) : (this._checkbox0Color || ButtonControl.iconCheckColor0), true, this._square ? null : "margin");
					defaultFocusElement.insertAdjacentElement("afterbegin", this._iconCheck);
				} else {
					this.removeEventListener("click", this._boundClick, { capture: true });
					this.role = "button";
					this.ariaChecked = null;
					if (this._iconCheck) {
						defaultFocusElement.removeChild(this._iconCheck);
						this._iconCheck = null;
					}
				}
				break;

			case "checked":
				const checked = (newValue !== null);

				if (this._checked === checked)
					return;

				this._checked = checked;

				if (!this._iconCheck)
					return;

				if (checked) {
					this.ariaChecked = "true";
					this._iconCheck.name = ButtonControl.iconCheckName1;
					this._iconCheck.color = this._checkbox1Color || ButtonControl.iconCheckColor1;
				} else {
					this.ariaChecked = "false";
					this._iconCheck.name = ButtonControl.iconCheckName0;
					this._iconCheck.color = this._checkbox0Color || ButtonControl.iconCheckColor0;
				}
				break;

			case "checkbox0-color":
				if (this._checkbox0Color === newValue)
					return;

				this._checkbox0Color = newValue;

				if (!this._iconCheck)
					return;

				if (!this._checked)
					this._iconCheck.color = newValue || ButtonControl.iconCheckColor0;
				break;

			case "checkbox1-color":
				if (this._checkbox1Color === newValue)
					return;

				this._checkbox1Color = newValue;

				if (!this._iconCheck)
					return;

				if (this._checked)
					this._iconCheck.color = newValue || ButtonControl.iconCheckColor1;
				break;

			case "icon-name":
				if (!newValue) {
					if (this._icon) {
						if (defaultFocusElement)
							defaultFocusElement.removeChild(this._icon);

						this._icon = null;
					}
				} else {
					if (!this._icon) {
						this._icon = Icon.create(newValue, this._color, true, this._square ? null : "margin");
						if (defaultFocusElement) {
							if (this._textNode)
								defaultFocusElement.insertBefore(this._icon, this._textNode);
							else
								defaultFocusElement.appendChild(this._icon);
						}
					} else {
						this._icon.name = newValue;
					}
				}
				break;

			case "text":
				if (this._text === newValue)
					return;

				this._text = newValue;

				if (!defaultFocusElement)
					return;

				this.ariaLabel = newValue;

				if (this._square || !newValue) {
					if (this._textNode) {
						defaultFocusElement.removeChild(this._textNode);
						this._textNode = null;
					}

					if (newValue)
						this.title = newValue;
					else
						this.removeAttribute("title");
				} else {
					this.removeAttribute("title");

					if (!this._textNode) {
						this._textNode = document.createTextNode(newValue);
						defaultFocusElement.appendChild(this._textNode);
					} else {
						this._textNode.nodeValue = newValue;
					}
				}
				break;
		}
	}
}

customElements.define("f-button", ButtonControl);
