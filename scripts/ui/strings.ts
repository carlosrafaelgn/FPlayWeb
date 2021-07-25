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
	public static Edit = "Edit";
	public static Delete = "Delete";
	public static Enable = "Enable";
	public static Disable = "Disable";
	public static Enabled = "Enabled";
	public static Disabled = "Disabled";
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
	public static Volume = "Volume";
	public static UnknownError = "Unknown error";
	public static AddFiles = "Add Files";
	public static AddFolders = "Add Folders";
	public static ShowFilter = "Show Filter";
	public static ShowPlaylist = "Show Playlist";
	public static UpdateAvailable = "Update Available!";
	public static PleaseRefresh = "Please, refresh the page to update the app 😊";

	public static init(): void {
		const language = ((navigator as any)["userLanguage"] as string || navigator.language);
		if (language && language.toLowerCase().indexOf("pt") === 0) {
			Strings.language = "pt-br";

			document.documentElement.setAttribute("lang", "pt-br");

			Strings.DecimalSeparator = ",";
			Strings.OppositeDecimalSeparator = ".";
			//Strings.Menu = "Menu";
			Strings.Edit = "Edit";
			Strings.Delete = "Excluir";
			Strings.Enable = "Habilitar";
			Strings.Disable = "Desabilitar";
			Strings.Enabled = "Habilitado";
			Strings.Disabled = "Desabilitado";
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
			//Strings.Volume = "Volume";
			Strings.UnknownError = "Erro desconhecido";
			Strings.AddFiles = "Adicionar Arquivos";
			Strings.AddFolders = "Adicionar Pastas";
			Strings.ShowFilter = "Exibir Filtro";
			Strings.ShowPlaylist = "Exibir Lista";
			Strings.UpdateAvailable = "Atualização Disponível!";
			Strings.PleaseRefresh = "Por favor, recarregue a página para atualizar a aplicação 😊";
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
