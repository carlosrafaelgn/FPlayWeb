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
	public static readonly outerSizeREM = 6;
	public static readonly baseSizePX = 12;
	private static readonly viewBox = `0 0 ${Icon.baseSizePX} ${Icon.baseSizePX}`;
	private static readonly paths: { [name: string]: string } = {
		"icon-add-folder": '<path d="M 11,3 H 6 L 5,2 H 1 v 8 H 11 Z M 9.5,7 H 8 V 8.5 H 7 V 7 H 5.5 V 6 H 7 V 4.5 H 8 V 6 h 1.5 z" />',
		"icon-add-title": '<path d="M 4.5 1.5 L 4.5 6.7753906 C 4.205 6.6053906 3.865 6.5 3.5 6.5 C 2.395 6.5 1.5 7.395 1.5 8.5 C 1.5 9.605 2.395 10.5 3.5 10.5 C 4.605 10.5 5.5 9.605 5.5 8.5 L 5.5 3.5 L 7.5 3.5 L 7.5 1.5 L 4.5 1.5 z M 8 6.5 L 8 8 L 6.5 8 L 6.5 9 L 8 9 L 8 10.5 L 9 10.5 L 9 9 L 10.5 9 L 10.5 8 L 9 8 L 9 6.5 L 8 6.5 z" />',
		"icon-artist": '<path d="M 6 1 C 5.17 1 4.5 1.67 4.5 2.5 L 4.5 5.5 C 4.5 6.33 5.17 7 6 7 C 6.83 7 7.5 6.33 7.5 5.5 L 7.5 2.5 C 7.5 1.67 6.83 1 6 1 z M 2.5 5.5 C 2.5 7.265 3.805 8.7159375 5.5 8.9609375 L 5.5 10.5 L 6.5 10.5 L 6.5 8.9609375 C 8.195 8.7159375 9.5 7.265 9.5 5.5 L 8.5 5.5 C 8.5 6.88 7.38 8 6 8 C 4.62 8 3.5 6.88 3.5 5.5 L 2.5 5.5 z" />',
		"icon-check": '<path d="M 4.5,8.085 2.415,6 1.705,6.705 4.5,9.5 l 6,-6 -0.705,-0.705 z" />',
		"icon-checkbox-0": '<path d="M 9,3 V 9 H 3 V 3 H 9 M 10,2 H 2 v 8 h 8 z" />',
		"icon-checkbox-1": '<path d="M 10,2 H 2 v 8 h 8 z M 5,8.5 2.5,6 3.205,5.295 5,7.085 8.795,3.29 9.5,4 Z" />',
		"icon-clear": '<path d="M 9.5,3.205 8.795,2.5 6,5.295 3.205,2.5 2.5,3.205 5.295,6 2.5,8.795 3.205,9.5 6,6.705 8.795,9.5 9.5,8.795 6.705,6 Z" />',
		"icon-close": '<path d="M 1.7070312 1 L 1 1.7070312 L 5.2929688 6 L 1 10.292969 L 1.7070312 11 L 6 6.7070312 L 10.292969 11 L 11 10.292969 L 6.7070312 6 L 11 1.7070312 L 10.292969 1 L 6 5.2929688 L 1.7070312 1 z" />',
		"icon-expand-less": '<path d="M 6,4 3,7 3.705,7.705 6,5.415 8.295,7.705 9,7 Z" />',
		"icon-expand-more": '<path d="M 8.295,4.295 6,6.585 3.705,4.295 3,5 6,8 9,5 Z" />',
		"icon-filter": '<path d="m 1.5,8.5 v 1 h 3 v -1 z m 0,-6 v 1 h 5 v -1 z m 5,8 v -1 h 4 v -1 h -4 v -1 h -1 v 3 z m -3,-6 v 1 h -2 v 1 h 2 v 1 h 1 v -3 z m 7,2 v -1 h -5 v 1 z m -3,-2 h 1 v -1 h 2 v -1 h -2 v -1 h -1 z" />',
		"icon-folder": '<path d="M 5,2 H 1 v 8 H 11 V 3 H 6 Z" />',
		"icon-folder-open": '<path d="M 11,3 H 6 L 5,2 H 1 v 8 H 11 Z M 10,9 H 2 V 4 h 8 z" />',
		"icon-maximize": '<path d="M 0 0 L 0 12 L 12 12 L 12 0 L 0 0 z M 1 1 L 11 1 L 11 11 L 1 11 L 1 1 z" />',
		"icon-menu": '<path d="m 1.5,9 h 9 V 8 h -9 z m 0,-2.5 h 9 v -1 h -9 z M 1.5,3 v 1 h 9 V 3 Z" />',
		"icon-minimize": '<path d="M 1,6 H 11 V 7 H 1 Z" />',
		"icon-more-h": '<path d="M 3,5 C 2.45,5 2,5.45 2,6 2,6.55 2.45,7 3,7 3.55,7 4,6.55 4,6 4,5.45 3.55,5 3,5 Z M 9,5 C 8.45,5 8,5.45 8,6 8,6.55 8.45,7 9,7 9.55,7 10,6.55 10,6 10,5.45 9.55,5 9,5 Z M 6,5 C 5.45,5 5,5.45 5,6 5,6.55 5.45,7 6,7 6.55,7 7,6.55 7,6 7,5.45 6.55,5 6,5 Z" />',
		"icon-more-v": '<path d="M 6,4 C 6.55,4 7,3.55 7,3 7,2.45 6.55,2 6,2 5.45,2 5,2.45 5,3 5,3.55 5.45,4 6,4 Z M 6,5 C 5.45,5 5,5.45 5,6 5,6.55 5.45,7 6,7 6.55,7 7,6.55 7,6 7,5.45 6.55,5 6,5 Z M 6,8 C 5.45,8 5,8.45 5,9 5,9.55 5.45,10 6,10 6.55,10 7,9.55 7,9 7,8.45 6.55,8 6,8 Z" />',
		"icon-next": '<path d="M 3,2 V 10 L 8,6 Z M 8,6 V 10 H 9 V 2 H 8 Z" />',
		"icon-pause": '<path d="M 3 2 L 3 10 L 5 10 L 5 2 L 3 2 z M 7 2 L 7 10 L 9 10 L 9 2 L 7 2 z" />',
		"icon-play": '<path d="M 3,2 9,6 3,10 Z" />',
		"icon-playlist": '<path d="m 7.5,3 h -6 v 1 h 6 z m 0,2 h -6 v 1 h 6 z m -6,3 h 4 V 7 h -4 z m 7,-5 V 7.09 C 8.345,7.035 8.175,7 8,7 7.17,7 6.5,7.67 6.5,8.5 6.5,9.33 7.17,10 8,10 8.83,10 9.5,9.33 9.5,8.5 V 4 H 11 V 3 Z" />',
		"icon-previous": '<path d="M 9,2 V 10 L 4,6 Z M 4,6 V 10 H 3 V 2 h 1 z" />',
		"icon-radio": '<path d="M 11,6 A 5,5 0 0 1 6,11 5,5 0 0 1 1,6 5,5 0 0 1 6,1 5,5 0 0 1 11,6 Z" />',
		"icon-radiobutton-0": '<path d="M 6,1 C 3.24,1 1,3.24 1,6 1,8.76 3.24,11 6,11 8.76,11 11,8.76 11,6 11,3.24 8.76,1 6,1 Z m 0,9 C 3.79,10 2,8.21 2,6 2,3.79 3.79,2 6,2 c 2.21,0 4,1.79 4,4 0,2.21 -1.79,4 -4,4 z" />',
		"icon-radiobutton-1": '<path d="M 6 1 C 3.24 1 1 3.24 1 6 C 1 8.76 3.24 11 6 11 C 8.76 11 11 8.76 11 6 C 11 3.24 8.76 1 6 1 z M 6 2 C 8.21 2 10 3.79 10 6 C 10 8.21 8.21 10 6 10 C 3.79 10 2 8.21 2 6 C 2 3.79 3.79 2 6 2 z M 6 3.5 A 2.5 2.5 0 0 0 3.5 6 A 2.5 2.5 0 0 0 6 8.5 A 2.5 2.5 0 0 0 8.5 6 A 2.5 2.5 0 0 0 6 3.5 z" />',
		"icon-restore": '<path d="M 2 0 L 2 2 L 0 2 L 0 12 L 10 12 L 10 10 L 12 10 L 12 0 L 2 0 z M 3 1 L 11 1 L 11 9 L 10 9 L 10 2 L 3 2 L 3 1 z M 1 3 L 9 3 L 9 11 L 1 11 L 1 3 z" />',
		"icon-stop": '<path d="m 2,2 h 8 v 8 H 2 Z" />',
		"icon-title": '<path d="M 6,1.5 V 6.775 C 5.705,6.605 5.365,6.5 5,6.5 c -1.105,0 -2,0.895 -2,2 0,1.105 0.895,2 2,2 1.105,0 2,-0.895 2,-2 v -5 h 2 v -2 z" />',
		"icon-volume": '<path d="m 1.5,4.5 v 3 h 2 L 6,10 V 2 L 3.5,4.5 Z M 8.25,6 C 8.25,5.115 7.74,4.355 7,3.985 V 8.01 C 7.74,7.645 8.25,6.885 8.25,6 Z M 7,1.615 v 1.03 C 8.445,3.075 9.5,4.415 9.5,6 9.5,7.585 8.445,8.925 7,9.355 v 1.03 C 9.005,9.93 10.5,8.14 10.5,6 10.5,3.86 9.005,2.07 7,1.615 Z" />',
	};

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
				icon
			);
		}

		return null;
	}

	public static createHTML(name: string, large: boolean, className?: string | null, id?: string | null): string {
		return `<i class="icon ${large ? "large" : ""} ${className || ""}" ${id ? ("id=" + id) : ""}><svg viewBox="${Icon.viewBox}">${Icon.paths[name]}</svg></i>`;
	}

	public static create(name: string, className?: string | null, id?: string | null, existingElement?: HTMLElement | null): HTMLElement {
		const i = existingElement || document.createElement("i"),
			svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");

		svg.setAttribute("viewBox", Icon.viewBox);
		svg.innerHTML = Icon.paths[name];

		if (id)
			i.setAttribute("id", id);

		i.className = (className ? ("icon " + className) : "icon");
		i.appendChild(svg);

		return i;
	}

	public static createLarge(name: string, className?: string | null, id?: string | null): HTMLElement {
		return Icon.create(name, className ? (className + " large") : "large", id);
	}
}
