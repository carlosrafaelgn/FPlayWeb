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

class Strings {
	public static language = "en";

	public static DecimalSeparator = ".";
	public static OppositeDecimalSeparator = ",";
	public static Oops = "Oops\u2026";

	public static Menu = "Menu";
	public static About = "About";
	public static Edit = "Edit";
	public static Delete = "Delete";
	public static Enable = "Enable";
	public static Disable = "Disable";
	public static Enabled = "Enabled";
	public static Disabled = "Disabled";
	public static AdvancedFilter = "Advanced filter";
	public static TraditionalFilter = "Traditional filter";
	public static OK = "OK";
	public static Cancel = "Cancel";
	public static Clear = "Clear";
	public static Back = "Back";
	public static Close = "Close";
	public static Refresh = "Refresh";
	public static Exit = "Exit";
	public static Previous = "Previous";
	public static Play = "Play";
	public static Pause = "Pause";
	public static PlayPause = "Play / Pause";
	public static Stop = "Stop";
	public static Next = "Next";
	public static LeftAbbrev = "L";
	public static RightAbbrev = "R";
	public static Volume = "Volume";
	public static Panning = "Panning";
	public static DownMixToMono = "Down-mix to mono";
	public static UnknownError = "Unknown error";
	public static AddFiles = "Add files";
	public static AddFolders = "Add folders";
	public static ShowEffects = "Show effects";
	public static ShowPlaylist = "Show playlist";
	public static UpdateAvailable = "Update available!";
	public static PleaseRefresh = "Please, refresh the page to update the app. 😊";
	public static AboutHTML = `FPlay for web is an experimental audio player. 😊<br />
<br />
For more information about the project, its source code and dependencies, check out its repository at <a target="_blank" href="https://github.com/carlosrafaelgn/FPlayWeb">github.com/carlosrafaelgn/FPlayWeb</a>.<br />
<br />
This project is licensed under the <a target="_blank" href="https://github.com/carlosrafaelgn/FPlayWeb/blob/master/LICENSE">MIT License</a>.`;

	public static toFixed(x: number, fractionDigits: number): string { return x.toFixed(fractionDigits); }

	public static init(): void {
		const language = ((navigator as any)["userLanguage"] as string || navigator.language);
		if (language && language.toLowerCase().indexOf("pt") === 0) {
			Strings.language = "pt-br";

			document.documentElement.setAttribute("lang", "pt-br");

			Strings.DecimalSeparator = ",";
			Strings.OppositeDecimalSeparator = ".";
			//Strings.Menu = "Menu";
			Strings.About = "Sobre";
			Strings.Edit = "Edit";
			Strings.Delete = "Excluir";
			Strings.Enable = "Ativar";
			Strings.Disable = "Desativar";
			Strings.Enabled = "Ativado";
			Strings.Disabled = "Desativado";
			Strings.AdvancedFilter = "Filtro avançado";
			Strings.TraditionalFilter = "Filtro tradicional";
			//Strings.OK = "OK";
			Strings.Cancel = "Cancelar";
			Strings.Clear = "Limpar";
			Strings.Back = "Voltar";
			Strings.Close = "Fechar";
			Strings.Refresh = "Recarregar";
			Strings.Exit = "Sair";
			Strings.Previous = "Anterior";
			Strings.Play = "Tocar";
			Strings.Pause = "Pausar";
			Strings.PlayPause = "Tocar / Pausar";
			Strings.Stop = "Parar";
			Strings.Next = "Próxima";
			Strings.LeftAbbrev = "E";
			Strings.RightAbbrev = "D";
			//Strings.Volume = "Volume";
			//Strings.Panning = "Panning";
			Strings.DownMixToMono = "Fazer down-mix para mono";
			Strings.UnknownError = "Erro desconhecido";
			Strings.AddFiles = "Adicionar arquivos";
			Strings.AddFolders = "Adicionar pastas";
			Strings.ShowEffects = "Exibir efeitos";
			Strings.ShowPlaylist = "Exibir playlist";
			Strings.UpdateAvailable = "Atualização disponível!";
			Strings.PleaseRefresh = "Por favor, recarregue a página para atualizar a aplicação. 😊";
			Strings.AboutHTML = `FPlay para web é um player de áudio experimental. 😊<br />
<br />
Para mais informações sobre o projeto, seu código-fonte e dependências, confira seu repositório em <a target="_blank" href="https://github.com/carlosrafaelgn/FPlayWeb">github.com/carlosrafaelgn/FPlayWeb</a>.<br />
<br />
Este projeto é licenciado sob a <a target="_blank" href="https://github.com/carlosrafaelgn/FPlayWeb/blob/master/LICENSE">MIT License</a>.`;
		}

		Strings.translateChildren(document.body);
	}

	public static translate(key: string): string {
		const v = (Strings as any)[key] as string | undefined;
		return (v !== undefined ? v : key);
	};

	public static translateChildren(parent: HTMLElement): void {
		const childNodes = parent.childNodes;
		for (let i = childNodes.length - 1; i >= 0; i--) {
			const c = childNodes[i] as HTMLElement;
			if (!c.tagName)
				continue;
			if (c.childNodes && c.childNodes.length)
				Strings.translateChildren(c);

			let d: string | null;

			if ((d = c.getAttribute("title")))
				c.setAttribute("title", Strings.translate(d));

			if (!(d = c.getAttribute("data-string")))
				continue;

			c.removeAttribute("data-string");

			let start = 0;
			do {
				let end = d.indexOf(";", start);
				if (end < start)
					end = d.length;

				const idx = d.indexOf("|", start);

				if (idx < 0 || idx >= end) {
					c.appendChild(document.createTextNode(Strings.translate(d)));
				} else {
					const attr = d.substring(start, idx),
						key = d.substring(idx + 1, end);
					c.setAttribute(attr, Strings.translate(key));
				}

				start = end + 1;
			} while (start < d.length);
		}
	}
}
