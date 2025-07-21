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
	private static readonly _regExpAmp = /\&/g;
	private static readonly _regExpLT = /</g;
	private static readonly _regExpGT = />/g;
	private static readonly _regExpQuot = /\"/g;
	private static readonly _regExpApos = /\'/g;
	private static readonly _regExpGrave = /\`/g;
	private static readonly _regExpDiacritics = /[\u0300-\u036f]/g;

	public static language = "en";

	public static comparer: (a: string, b: string) => number;

	public static decimalSeparator = ".";
	public static oppositeDecimalSeparator = ",";

	public static Oops = "Oops\u2026";
	public static AppName = "FPlay";
	public static Menu = "Menu";
	public static About = "About";
	public static Options = "Options";
	public static Edit = "Edit";
	public static Delete = "Delete";
	public static DeleteSongs = "Delete songs";
	public static DeleteAllSongs = "Delete all";
	public static Enable = "Enable";
	public static Disable = "Disable";
	public static Enabled = "Enabled";
	public static Disabled = "Disabled";
	public static Selected = "Selected";
	public static AdvancedFilter = "Advanced filter";
	public static TraditionalFilter = "Traditional filter";
	public static Missing = "Missing";
	public static MissingSongError = "The song is missing! 😢 Please, just add it again before playing it. When you add a missing song, it keeps its position in the playlist! 😊";
	public static FileNotFoundOrNoPermissionError = "The song's file could not be found or the permission to access it was not granted! 😢";
	public static NothingSelected = "Nothing selected! 😅";
	public static OK = "OK";
	public static Cancel = "Cancel";
	public static Clear = "Clear";
	public static Back = "Back";
	public static Close = "Close";
	public static Refresh = "Refresh";
	public static Exit = "Exit";
	public static Done = "Done";
	public static Up = "Up";
	public static All = "All";
	public static Storage = "Storage";
	public static Previous = "Previous";
	public static Play = "Play";
	public static Pause = "Pause";
	public static PlayPause = "Play / Pause";
	public static Stop = "Stop";
	public static Next = "Next";
	public static Seek = "Seek";
	public static Path = "Path";
	public static PathLabel = "Path: ";
	public static Title = "Title";
	public static TitleLabel = "Title: ";
	public static CurrentTitleLabel = "Current title: ";
	public static Album = "Album";
	public static AlbumLabel = "Album: ";
	public static CurrentAlbumLabel = "Current album: ";
	public static Artist = "Artist";
	public static ArtistLabel = "Artist: ";
	public static CurrentArtistLabel = "Current artist: ";
	public static Duration = "Duration";
	public static DurationLabel = "Duration: ";
	public static Track = "Track";
	public static TrackLabel = "Track: ";
	public static Year = "Year";
	public static YearLabel = "Year: ";
	public static SampleRate = "Sample rate";
	public static SampleRateLabel = "Sample rate: ";
	public static Channels = "Channels";
	public static ChannelsLabel = "Channels: ";
	public static ShowInfo = "Show information";
	public static SongInfo = "Song information";
	public static Search = "Search";
	public static SearchResults = "Search results";
	public static SearchPlaceholder = "Title, artist, album, year or path";
	public static NoSongPlaying = "No song playing! 😅";
	public static Playlist = "Playlist";
	public static FileList = "File list";
	public static CurrentPathLabel = "Current path: ";
	public static Loading = "Loading";
	public static LoadingLabel = "Loading\u2026 ";
	public static LoadingCurrentPathLabel = "Loading current path: ";
	public static Folder = "Folder";
	public static FolderLabel = "Folder: ";
	public static LeftAbbrev = "L";
	public static RightAbbrev = "R";
	public static Volume = "Volume";
	public static Panning = "Panning";
	public static DownMixToMono = "Down-mix to mono";
	public static UnknownError = "Something went wrong during playback. 😢";
	public static Add = "Add";
	public static AddFiles = "Add files";
	public static AddSongs = "Add songs";
	public static AddFolders = "Add folders";
	public static AddMoreFolders = "Add more folders\u2026";
	public static ShowEffects = "Show effects";
	public static ShowPlaylist = "Show playlist";
	public static NoSongsInFolder = "No songs in folder. 😳";
	public static NoSongsFoundInPlaylist = "No songs found in the playlist. 😳";
	public static PlaylistControlEmptyMessage = `Use the \"${Strings.AddSongs}\" button to add songs to the playlist. 😊`;
	public static UpdateAvailable = "Update available!";
	public static PleaseRefresh = "Please, refresh the page to update the app. 😊";
	public static RGBMode = "RGB Mode";
	public static AnimatedRGBMode = "Animated RGB Mode";
	public static ExtraRGBMode = "Extra RGB Mode";
	public static NeonMode = "Neon Mode";
	public static AboutHTML = `<p>FPlay Web is an experimental audio player. 😊</p>
<p>For more information about the project, its source code and dependencies, check out its repository at <a target="_blank" href="https://github.com/carlosrafaelgn/FPlayWeb">github.com/carlosrafaelgn/FPlayWeb</a>.</p>
<p>This project is licensed under the <a target="_blank" href="https://github.com/carlosrafaelgn/FPlayWeb/blob/master/LICENSE">MIT License</a>.</p>`;
	// Click, press, tap, push, hit.... Which one to use for BOTH touch and non-touch devices!!! Ahhhhhhhhhhh!!!!!!!!!!
	public static DeleteModeHTML = `Click songs to delete them.`;

	public static toFixed(x: number, fractionDigits: number): string { return x.toFixed(fractionDigits); }

	public static init(): void {
		Strings.comparer = ((("Intl" in window) && (Intl.Collator)) ?
			(new Intl.Collator(undefined, { usage: "sort", sensitivity: "variant", numeric: true })).compare :
			function (a: string, b: string): number { return a.localeCompare(b); });

		const language = ((App.hostInterface && App.hostInterface.getBrowserLanguage()) || (navigator as any)["userLanguage"] as string || navigator.language);
		if (language && language.toLowerCase().indexOf("pt") === 0) {
			Strings.language = "pt-br";

			document.documentElement.lang = "pt-br";

			Strings.decimalSeparator = ",";
			Strings.oppositeDecimalSeparator = ".";
			//Strings.Menu = "Menu";
			Strings.About = "Sobre";
			Strings.Options = "Opções";
			Strings.Edit = "Edit";
			Strings.Delete = "Excluir";
			Strings.DeleteSongs = "Excluir músicas";
			Strings.DeleteAllSongs = "Excluir todas";
			Strings.Enable = "Ativar";
			Strings.Disable = "Desativar";
			Strings.Enabled = "Ativado";
			Strings.Disabled = "Desativado";
			Strings.Selected = "Selecionado";
			Strings.AdvancedFilter = "Filtro avançado";
			Strings.TraditionalFilter = "Filtro tradicional";
			Strings.Missing = "Faltando";
			Strings.MissingSongError = "A música está faltando! 😢 Por favor, apenas adicione novamente a música antes de tocar. Quando você adiciona uma música que está faltando, ela fica na mesma posição dentro da playlist! 😊";
			Strings.FileNotFoundOrNoPermissionError = "O arquivo da música não foi encontrado ou não foi dada permissão de acesso a ele! 😢";
			Strings.NothingSelected = "Nada foi selecionado! 😅";
			//Strings.OK = "OK";
			Strings.Cancel = "Cancelar";
			Strings.Clear = "Limpar";
			Strings.Back = "Voltar";
			Strings.Close = "Fechar";
			Strings.Refresh = "Recarregar";
			Strings.Exit = "Sair";
			Strings.Done = "Concluído";
			Strings.Up = "Acima";
			Strings.All = "Tudo";
			Strings.Storage = "Armazenamento";
			Strings.Previous = "Anterior";
			Strings.Play = "Tocar";
			Strings.Pause = "Pausar";
			Strings.PlayPause = "Tocar / Pausar";
			Strings.Stop = "Parar";
			Strings.Next = "Próxima";
			Strings.Seek = "Buscar";
			Strings.Path = "Caminho";
			Strings.PathLabel = "Caminho: ";
			Strings.Title = "Título";
			Strings.TitleLabel = "Título: ";
			Strings.CurrentTitleLabel = "Título atual: ";
			Strings.Album = "Álbum";
			Strings.AlbumLabel = "Álbum: ";
			Strings.CurrentAlbumLabel = "Álbum atual: ";
			Strings.Artist = "Artista";
			Strings.ArtistLabel = "Artista: ";
			Strings.CurrentArtistLabel = "Artista atual: ";
			Strings.Duration = "Duração";
			Strings.DurationLabel = "Duração: ";
			Strings.Track = "Faixa";
			Strings.TrackLabel = "Faixa: ";
			Strings.Year = "Ano";
			Strings.YearLabel = "Ano: ";
			Strings.SampleRate = "Taxa de amostragem";
			Strings.SampleRateLabel = "Taxa de amostragem: ";
			Strings.Channels = "Canais";
			Strings.ChannelsLabel = "Canais: ";
			Strings.ShowInfo = "Exibir informações";
			Strings.SongInfo = "Informações da música";
			Strings.Search = "Pesquisar";
			Strings.SearchResults = "Resultados da pesquisa";
			Strings.SearchPlaceholder = "Título, artista, álbum, ano ou caminho";
			Strings.NoSongPlaying = "Nenhuma música tocando! 😅";
			Strings.Playlist = "Playlist";
			Strings.FileList = "Lista de arquivos";
			Strings.CurrentPathLabel = "Caminho atual: ";
			Strings.Loading = "Carregando";
			Strings.LoadingLabel = "Carregando\u2026 ";
			Strings.LoadingCurrentPathLabel = "Carregando camino atual: ";
			Strings.Folder = "Pasta";
			Strings.FolderLabel = "Pasta: ";
			Strings.LeftAbbrev = "E";
			Strings.RightAbbrev = "D";
			//Strings.Volume = "Volume";
			//Strings.Panning = "Panning";
			Strings.DownMixToMono = "Fazer down-mix para mono";
			Strings.UnknownError = "Algo saiu errado durante a reprodução. 😢";
			Strings.Add = "Adicionar";
			Strings.AddFiles = "Adicionar arquivos";
			Strings.AddSongs = "Adicionar músicas";
			Strings.AddFolders = "Adicionar pastas";
			Strings.AddMoreFolders = "Adicionar mais pastas\u2026";
			Strings.ShowEffects = "Exibir efeitos";
			Strings.ShowPlaylist = "Exibir playlist";
			Strings.NoSongsInFolder = "Nenhuma música na pasta. 😳";
			Strings.NoSongsFoundInPlaylist = "Nenhuma música encontrada na playlist. 😳";
			Strings.PlaylistControlEmptyMessage = `Utilize o botão \"${Strings.AddSongs}\" para adicionar músicas à playlist. 😊`;
			Strings.UpdateAvailable = "Atualização disponível!";
			Strings.PleaseRefresh = "Por favor, recarregue a página para atualizar a aplicação. 😊";
			Strings.RGBMode = "Modo RGB";
			Strings.AnimatedRGBMode = "Modo RGB Animado";
			Strings.ExtraRGBMode = "Modo RGB Extra";
			Strings.NeonMode = "Modo Neon";
			Strings.AboutHTML = `<p>FPlay Web é um player de áudio experimental. 😊</p>
<p>Para mais informações sobre o projeto, seu código-fonte e dependências, confira seu repositório em <a target="_blank" href="https://github.com/carlosrafaelgn/FPlayWeb">github.com/carlosrafaelgn/FPlayWeb</a>.</p>
<p>Este projeto é licenciado sob a <a target="_blank" href="https://github.com/carlosrafaelgn/FPlayWeb/blob/master/LICENSE">MIT License</a>.</p>`;
			Strings.DeleteModeHTML = `Clique as músicas para excluí-las.`;
		}
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

			let d: string | null | undefined;

			if ((d = c.title))
				c.title = Strings.translate(d);

			if (!(d = c.dataset["string"]))
				continue;

			delete c.dataset["string"];

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
					(c as any)[attr] = Strings.translate(key);
				}

				start = end + 1;
			} while (start < d.length);
		}
	}

	public static changeText(element: HTMLElement | null, text: string | null): void {
		if (!element)
			return;

		if (text === null)
			text = "";

		const node = element.lastChild;
		if (!node)
			element.appendChild(document.createTextNode(text));
		else
			node.nodeValue = text;
	}

	public static createSrOnlyText(text: string): HTMLSpanElement {
		const span = document.createElement("span");
		span.className = "sr-only";
		Strings.changeText(span, text);
		return span;
	}

	public static htmlEncode(text: string | null): string {
		return (text ? text.replace(Strings._regExpAmp, "&amp;").replace(Strings._regExpLT, "&lt;").replace(Strings._regExpGT, "&gt;") : "");
	}

	public static htmlEncodeValue(text: string | null): string {
		return (text ? text.replace(Strings._regExpAmp, "&amp;").replace(Strings._regExpLT, "&lt;").replace(Strings._regExpGT, "&gt;").replace(Strings._regExpQuot, "&#34;").replace(Strings._regExpApos, "&#39;").replace(Strings._regExpGrave, "&#96;") : "");
	}

	public static removeDiacritics(text: string | null): string {
		return (text ? text.normalize("NFD") // Decompose characters with diacritics into their base character plus combining diacritic marks (ã" becomes "a" + combining tilde)
			.replace(Strings._regExpDiacritics, "") // Remove combining diacritic marks
			.toLowerCase() : "");
	}
}
