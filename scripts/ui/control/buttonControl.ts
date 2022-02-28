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
	icon?: string | null;
	text?: string | null;
	stringKey?: string | null;
	color?: string | null;
	square?: boolean | null;
	opaque?: boolean | null;
	keyboardFocusable?: boolean | null;
	className?: string | null;
}

interface ButtonControlOptions extends CommonButtonControlOptions {
	parent?: HTMLElement | null;
	onclick?: (() => void) | null;
}

class ButtonControl {
	public static init(): void {
		const buttons = document.getElementsByTagName("button");
		if (buttons) {
			for (let i = buttons.length - 1; i >= 0; i--)
				ButtonControl.prepare(buttons[i] as HTMLButtonElement);
		}
	}

	public static create(options: CommonButtonControlOptions | ButtonControlOptions, skipClickAndAppend?: boolean): HTMLButtonElement {
		const button = document.createElement("button");
		button.setAttribute("type", "button");

		if (options.id)
			button.setAttribute("id", options.id);

		if (options.keyboardFocusable === false)
			button.setAttribute("tabindex", "-1");

		let className = "btn";

		if (options.color)
			className += " " + options.color;
		if (options.square)
			className += " square";
		if (!options.opaque)
			className += " transparent";
		if (options.className)
			className += " " + options.className;

		button.className = className;

		const span = document.createElement("span"),
			text = (options.text || (options.stringKey ? Strings.translate(options.stringKey) : ""));

		span.setAttribute("tabindex", "-1");
		span.setAttribute("aria-hidden", "true");

		if (options.icon) {
			className = "large";
			if (!options.square && text)
				className += " margin";
			if (!options.opaque && options.color)
				className += " " + options.color;

			span.appendChild(Icon.create(options.icon, className));
		}

		button.setAttribute("aria-label", text);

		if (options.square)
			button.setAttribute("title", text);
		else
			span.appendChild(document.createTextNode(text));

		if (!skipClickAndAppend) {
			const o = options as ButtonControlOptions;

			if (o.onclick)
				button.onclick = o.onclick;

			if (o.parent)
				o.parent.appendChild(button);
		}

		button.appendChild(span);

		return button;
	}

	public static prepare(button: HTMLButtonElement): HTMLSpanElement {
		const span = document.createElement("span");
		span.setAttribute("tabindex", "-1");
		span.setAttribute("aria-hidden", "true");

		while (button.firstChild) {
			const firstChild = button.firstChild;
			button.removeChild(firstChild);
			span.appendChild(firstChild);
		}

		button.appendChild(span);

		button.setAttribute("aria-label", (button.classList.contains("square") ? button.getAttribute("title") : button.textContent) as string);

		return span;
	}

	public static setText(button: HTMLButtonElement, text: string): void {
		button.setAttribute("aria-label", text);

		let span = button.firstChild as HTMLElement;
		if (!span || span.tagName !== "SPAN") {
			span = button.querySelector("span") as HTMLElement;
			if (!span)
				return;
		}

		const textNode = span.lastChild;
		if (!textNode || (textNode as HTMLElement).tagName)
			span.appendChild(document.createTextNode(text));
		else
			textNode.nodeValue = text;
	}

	public static getDefaultFocusElement(button: HTMLButtonElement): HTMLElement {
		const spans = button.getElementsByTagName("span");
		return (spans[0] || button);
	}
}
