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

class Icon {
	public static readonly baseSizePX = 12;

	public static init(): void {
		const icons = document.getElementsByTagName("i");
		if (icons) {
			for (let i = icons.length - 1; i >= 0; i--)
				Icon.prepare(icons[i]);
		}
	}

	public static prepare(icon: HTMLElement | null): HTMLElement | null {
		if (!icon)
			return null;

		const className = icon.className;

		let i: number;

		if (className && (i = className.indexOf("icon-")) >= 0 && icon.parentNode) {
			const j = className.indexOf(" ", i);

			return Icon.create(
				(j > i) ? className.substring(i, j) : className.substring(i),
				(j > i) ? (className.substring(0, i) + className.substring(j + 1)) : className.substring(0, i),
				null,
				null,
				icon
			);
		}

		return null;
	}

	public static createHTML(name: string, large: boolean, className?: string | null, id?: string | null): string {
		return `<i class="icon ${large ? "large" : ""} ${className || ""}" ${id ? ("id=" + id) : ""}><svg aria-hidden="true"><use href="#${name}" /></svg></i>`;
	}

	public static create(name: string, className?: string | null, id?: string | null, title?: string | null, existingElement?: HTMLElement | null): HTMLElement {
		const i = existingElement || document.createElement("i"),
			svg = document.createElementNS("http://www.w3.org/2000/svg", "svg"),
			use = document.createElementNS("http://www.w3.org/2000/svg", "use");

		svg.setAttribute("aria-hidden", "true");
		use.setAttribute("href", "#" + name);
		svg.appendChild(use);

		if (id)
			i.setAttribute("id", id);

		i.className = (className ? ("icon " + className) : "icon");

		if (existingElement && !title) {
			title = existingElement.getAttribute("data-title");
			existingElement.removeAttribute("data-title");
		}

		if (title)
			i.appendChild(Strings.createSrOnlyText(title));
		else
			i.setAttribute("aria-hidden", "true");

		i.appendChild(svg);

		return i;
	}

	public static createLarge(name: string, className?: string | null, id?: string | null, title?: string | null): HTMLElement {
		return Icon.create(name, className ? (className + " large") : "large", id, title);
	}
}
