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
	parent?: HTMLElement | null;
	id?: string | null;
	className?: string | null;
}

class CheckboxControl {
	public static init(): void {
		const inputs = document.querySelectorAll("input[type=checkbox]");
		if (inputs) {
			for (let i = inputs.length - 1; i >= 0; i--)
				CheckboxControl.prepare(inputs[i] as HTMLInputElement);
		}
	}

	public static create(options: CheckboxControlOptions): HTMLButtonElement {
		const input = document.createElement("input");

		input.setAttribute("type", "checkbox");
		input.setAttribute("value", options.stringKey);

		if (options.id)
			input.setAttribute("id", options.id);

		if (options.className)
			input.className = options.className;

		const button = CheckboxControl.prepare(input);

		if (options.parent)
			options.parent.appendChild(button);

		return button;
	}

	private static prepare(input: HTMLInputElement): HTMLButtonElement {
		const button = document.createElement("button"),
			span = document.createElement("span"),
			parent = input.parentNode as HTMLElement | null,
			label = input.getAttribute("title") || Strings.translate(input.value);

		button.setAttribute("type", "button");
		button.setAttribute("role", "checkbox");
		button.setAttribute("aria-label", label);
		span.setAttribute("tabindex", "-1");
		input.setAttribute("tabindex", "-1");
		input.setAttribute("aria-label", label);

		button.className = input.className;
		input.className = "";

		if (parent) {
			parent.insertBefore(button, input);
			parent.removeChild(input);
		}

		button.appendChild(span);
		span.appendChild(input);
		span.appendChild(Icon.createLarge("icon-checkbox-0", "margin"));
		span.appendChild(Icon.createLarge("icon-checkbox-1", "margin orange"));
		span.appendChild(document.createTextNode(label));
		input.removeAttribute("value");
		input.removeAttribute("title");

		button.onclick = CheckboxControl.click;

		return button;
	}

	private static click(e: Event): void {
		const label = (e.target || this) as HTMLLabelElement,
			inputs = label.getElementsByTagName("input");

		if (inputs && inputs[0])
			inputs[0].click();
	}
}
