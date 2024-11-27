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

interface CheckboxControlOptions {
	stringKey: string;
	id?: string | null;
	icon?: string | null;
	iconColor?: string | null;
	checkbox0Color?: string | null;
	checkbox1Color?: string | null;
	color?: string | null;
	square?: boolean | null;
	opaque?: boolean | null;
	keyboardFocusable?: boolean | null;
	className?: string | null;
	checked?: boolean | null;
	parent?: HTMLElement | null;
	onclick?: (() => void) | null;
}

class CheckboxControl {
	private static internalId = 0;

	public static init(): void {
		const inputs = document.querySelectorAll("input[type=checkbox]");
		if (inputs) {
			for (let i = inputs.length - 1; i >= 0; i--)
				CheckboxControl.prepare(inputs[i] as HTMLInputElement, true);
		}
	}

	public static isChecked(checkboxButton: HTMLLabelElement): boolean {
		const input: HTMLInputElement = (checkboxButton as any).childInput;
		return (input ? input.checked : false);
	}

	public static setChecked(checkboxButton: HTMLLabelElement, checked?: boolean | null): void {
		const input: HTMLInputElement = (checkboxButton as any).childInput;
		if (input) {
			input.checked = !!checked;
			checkboxButton.setAttribute("aria-pressed", checked ? "true" : "false");
			//if (!!input.checked !== !!checked)
			//	input.click();
		}
	}

	public static create(options: CheckboxControlOptions): HTMLLabelElement {
		const input = document.createElement("input");

		input.setAttribute("type", "checkbox");
		input.setAttribute("value", options.stringKey);
		if (options.square)
			input.setAttribute("data-square", "1");

		if (options.id)
			input.setAttribute("id", options.id);

		let className = "btn";

		if (options.color)
			className += " " + options.color;
		if (options.square)
			className += " square";
		if (!options.opaque)
			className += " transparent";
		if (options.className)
			className += " " + options.className;

		input.className = className;

		const button = CheckboxControl.prepare(input, options.keyboardFocusable, options.icon, options.iconColor, options.checkbox0Color, options.checkbox1Color, options.checked, options.onclick);

		if (options.keyboardFocusable === false)
			button.setAttribute("tabindex", "-1");

		if (options.parent)
			options.parent.appendChild(button);

		return button;
	}

	private static prepare(input: HTMLInputElement, keyboardFocusable?: boolean | null, icon?: string | null, iconColor?: string | null, checkbox0Color?: string | null, checkbox1Color?: string | null, checked?: boolean | null, onclick?: (() => void) | null): HTMLLabelElement {
		const button = document.createElement("label"),
			span = document.createElement("span"),
			parent = input.parentNode as HTMLElement | null,
			square = icon ? null : input.getAttribute("data-square"),
			label = Strings.translate(input.getAttribute("title") || input.value);

		let id = input.getAttribute("id");
		if (!id) {
			id = "checkBoxControl" + (CheckboxControl.internalId++);
			input.setAttribute("id", id);
		}

		button.setAttribute("aria-label", label);
		button.setAttribute("aria-pressed", input.checked ? "true" : "false");
		button.setAttribute("role", "button");
		button.setAttribute("for", id);
		button.setAttribute("tabindex", "0");
		span.setAttribute("tabindex", "-1");
		//span.setAttribute("aria-hidden", "true");
		input.setAttribute("tabindex", "-1");
		//input.setAttribute("aria-hidden", "true");

		button.className = input.className;
		input.className = "";

		if (!icon)
			icon = input.getAttribute("data-icon");

		if (icon && !iconColor)
			iconColor = input.getAttribute("data-icon-color");

		if (!checkbox0Color)
			checkbox0Color = input.getAttribute("data-checkbox0-color");

		if (!checkbox1Color) {
			checkbox1Color = input.getAttribute("data-checkbox1-color");
			if (!checkbox1Color)
				checkbox1Color = "orange";
		}

		if (parent) {
			parent.insertBefore(button, input);
			parent.removeChild(input);
		}

		button.appendChild(span);
		span.appendChild(input);
		span.appendChild(Icon.createLarge("icon-checkbox-0", (square ? "" : "margin") + (checkbox0Color ? (" " + checkbox0Color) : "")));
		span.appendChild(Icon.createLarge("icon-checkbox-1", square ? checkbox1Color : ("margin " + checkbox1Color)));
		if (icon)
			span.appendChild(Icon.createLarge(icon, iconColor ? ("margin " + iconColor) : "margin"));
		if (!square)
			span.appendChild(document.createTextNode(label));
		input.removeAttribute("value");
		input.removeAttribute("title");

		(button as any).childInput = input;

		button.addEventListener("click", CheckboxControl.buttonClick);

		if (keyboardFocusable || keyboardFocusable === undefined)
			button.addEventListener("keydown", CheckboxControl.buttonKeyDown);

		if (checked)
			CheckboxControl.setChecked(button, checked);

		if (onclick)
			input.onclick = onclick;

		return button;
	}

	private static buttonClick(e: Event): void {
		const input: HTMLInputElement = (this as any).childInput;
		if (input)
			(this as any).setAttribute("aria-pressed", input.checked ? "true" : "false");
	}

	private static buttonKeyDown(e: KeyboardEvent): any {
		if (e.ctrlKey || e.metaKey || e.shiftKey || e.altKey || e.repeat || !(e.key === "Enter" || e.key === " "))
			return;

		cancelEvent(e);

		(this as any).click();
		try {
			(this as any).focus();
		} catch (ex: any) {
			// Just ignore...
		}

		return false;
	}
}
