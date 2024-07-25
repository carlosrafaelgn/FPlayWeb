//
// FPlayAndroid is distributed under the FreeBSD License
//
// Copyright (c) 2013-2014, Carlos Rafael Gimenes das Neves
// All rights reserved.
//
// Redistribution and use in source and binary forms, with or without
// modification, are permitted provided that the following conditions are met:
//
// 1. Redistributions of source code must retain the above copyright notice, this
//    list of conditions and the following disclaimer.
// 2. Redistributions in binary form must reproduce the above copyright notice,
//    this list of conditions and the following disclaimer in the documentation
//    and/or other materials provided with the distribution.
//
// THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND
// ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED
// WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
// DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT OWNER OR CONTRIBUTORS BE LIABLE FOR
// ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES
// (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES;
// LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND
// ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
// (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS
// SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
//
// The views and conclusions contained in the software and documentation are those
// of the authors and should not be interpreted as representing official policies,
// either expressed or implied, of the FreeBSD Project.
//
// https://github.com/carlosrafaelgn/FPlayAndroid
//
package br.com.carlosrafaelgn.fplayweb.list;

import android.content.Context;
import android.database.Cursor;
import android.net.Uri;
import android.os.Build;
import android.os.Environment;
import android.os.Handler;
import android.os.Looper;

import java.io.BufferedReader;
import java.io.File;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.util.Arrays;
import java.util.HashMap;
import java.util.Locale;

import br.com.carlosrafaelgn.fplayweb.R;
import br.com.carlosrafaelgn.fplayweb.util.ArraySorter;
import br.com.carlosrafaelgn.fplayweb.util.TypedRawArrayList;

//
//Supported Media Formats
//http://developer.android.com/guide/appendix/media-formats.html
//
@SuppressWarnings("StringEquality")
public final class FileFetcher implements Runnable, ArraySorter.Comparer<FileSt> {
	public interface Listener {
		void onFilesFetched(FileFetcher fetcher, Throwable e);
	}

	private static final class RootItem {
		public final String fs_specLC, pathLC, path;
		public final boolean isFileSystemTypeValid;

		public RootItem(String fs_spec, String path, boolean isFileSystemTypeValid) {
			this.fs_specLC = fs_spec.toLowerCase(Locale.US);
			this.pathLC = path.toLowerCase(Locale.US);
			this.path = path;
			this.isFileSystemTypeValid = isFileSystemTypeValid;
		}

		@Override
		public int hashCode() {
			return fs_specLC.hashCode();
		}

		@Override
		public boolean equals(Object o) {
			if (o instanceof String)
				return fs_specLC.equals(o);
			return fs_specLC.equals(((RootItem)o).fs_specLC);
		}
	}

	private static final int LIST_DELTA = 32;
	private static final HashMap<String, String> supportedTypes;
	public final String path, unknownArtist;
	public final int version;
	public FileSt[] files;
	public String[] sections;
	public int[] sectionPositions;
	public int count;
	private final Context context;
	private Throwable notifyE;
	private Listener listener;
	private final boolean recursive;
	private final Handler listenerHandler;
	private Thread thread;
	private volatile boolean cancelled;

	static {
		//Media formats, file extensions and mime types
		//http://developer.android.com/guide/appendix/media-formats.html
		supportedTypes = new HashMap<>(4);
		supportedTypes.put(".aac", "audio/aac");
		supportedTypes.put(".mp3", "audio/mpeg");
		supportedTypes.put(".wav", "audio/wav"); //audio/vnd.wave ?
		supportedTypes.put(".flac", "audio/flac");
		supportedTypes.put(".ogg", "audio/ogg");
	}

	private static boolean accept(File file) {
		if (file.isDirectory()) return true;
		final String name = file.getName();
		final int i = name.lastIndexOf('.');
		return ((i >= 0) && supportedTypes.containsKey(name.substring(i).toLowerCase(Locale.US)));
	}

	public FileFetcher(Context context, String path, int version, Listener listener, Handler listenerHandler, boolean recursive) {
		this.context = context;
		this.files = new FileSt[LIST_DELTA];
		this.count = 0;
		this.path = path;
		this.version = version;

		String unk;
		try {
			unk = context.getText(R.string.unknownArtist).toString();
		} catch (Throwable ex) {
			unk = "(???)";
		}
		unknownArtist = unk;
		this.listener = listener;
		this.listenerHandler = listenerHandler;
		this.recursive = recursive;

		thread = new Thread(this, "File Fetcher Thread");
		thread.setDaemon(true);
		thread.start();
	}

	private void ensureCapacity(int capacity) {
		if (capacity < count)
			return;

		if (capacity > files.length ||
			capacity <= (files.length - (2 * LIST_DELTA))) {
			capacity += LIST_DELTA;
		} else {
			return;
		}

		files = Arrays.copyOf(files, capacity);
	}

	private void addStorage(File path, boolean isExternal, int[] internalCount, int[] externalCount, int[] usbCount, int[] addedCount, String[] addedPaths) throws Throwable {
		if (!path.exists() || !path.isDirectory())
			return;

		int c = addedCount[0];
		if (c >= addedPaths.length)
			return;

		//readlink command could be used instead? which is better???
		//http://www.computerhope.com/unix/readlink.htm
		String canonicalPath = path.getCanonicalFile().getAbsolutePath();
		String canonicalPathLC = canonicalPath.toLowerCase(Locale.US);
		try {
			//limit the amount of iterations while resolving symlinks
			for (int i = 4; i > 0; i--) {
				final File file = new File(canonicalPath);
				final String p = file.getCanonicalFile().getAbsolutePath();
				final String pLC = p.toLowerCase(Locale.US);
				if (pLC.equals(canonicalPathLC))
					break;
				canonicalPath = p;
				canonicalPathLC = pLC;
			}
		} catch (Throwable ex) {
			ex.printStackTrace();
		}

		for (int i = c - 1; i >= 0; i--) {
			if (canonicalPathLC.equals(addedPaths[i]))
				return;
		}

		addedPaths[c] = canonicalPathLC;
		addedCount[0] = c + 1;
		if (isExternal) {
			if (canonicalPathLC.contains("usb")) {
				c = usbCount[0] + 1;
				files[count] = new FileSt(canonicalPath, context.getText(R.string.usb_storage) + ((c <= 1) ? "" : (" " + c)), FileSt.TYPE_EXTERNAL_STORAGE_USB);
				usbCount[0] = c;
			} else {
				//try to avoid duplication of internal sdcard on a few phones...
				if (internalCount[0] > 0 && canonicalPathLC.contains("/legacy")) {
					//ignore this path in addedPaths
					addedCount[0]--;
					addedPaths[addedCount[0]] = null;
					return;
				}
				c = externalCount[0] + 1;
				files[count] = new FileSt(canonicalPath, context.getText(R.string.external_storage) + ((c <= 1) ? "" : (" " + c)), FileSt.TYPE_EXTERNAL_STORAGE);
				externalCount[0] = c;
			}
		} else {
			files[count] = new FileSt(canonicalPath, context.getText(R.string.internal_storage).toString(), FileSt.TYPE_INTERNAL_STORAGE);
			internalCount[0]++;
		}
		count++;
	}

	private void fetchRoot() {
		File f;
		try {
			f = Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_MUSIC);
			if (f.exists() && f.isDirectory()) {
				files[count] = new FileSt(f.getAbsolutePath(), context.getText(R.string.music).toString(), FileSt.TYPE_MUSIC);
				count++;
			}
		} catch (Throwable ex) {
			ex.printStackTrace();
		}
		try {
			f = Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS);
			if (f.exists() && f.isDirectory()) {
				files[count] = new FileSt(f.getAbsolutePath(), context.getText(R.string.downloads).toString(), FileSt.TYPE_DOWNLOADS);
				count++;
			}
		} catch (Throwable ex) {
			ex.printStackTrace();
		}

		if (cancelled)
			return;

		int i;
		int[] internalCount = new int[1], externalCount = new int[1], usbCount = new int[1], addedCount = new int[1];
		String[] addedPaths = new String[16];
		String path;

		try {
			addStorage(Environment.getExternalStorageDirectory(), Environment.isExternalStorageRemovable(), internalCount, externalCount, usbCount, addedCount, addedPaths);
		} catch (Throwable ex) {
			ex.printStackTrace();
		}

		InputStream is = null;
		InputStreamReader isr = null;
		BufferedReader br = null;
		try {
			final HashMap<String, RootItem> map = new HashMap<>(32);
			String line;
			is = Runtime.getRuntime().exec("mount").getInputStream();
			isr = new InputStreamReader(is);
			br = new BufferedReader(isr);
			while ((line = br.readLine()) != null) {
				if (cancelled)
					break;

				//skip secure storages (accessing them usually result in
				//a permission denied error)
				if (line.isEmpty() ||
					line.contains("secure") ||
					line.contains("asec")) continue;

				//http://unix.stackexchange.com/questions/91960/can-anyone-explain-the-output-of-mount

				//every line returned by mount must be seen as
				//fs_spec fs_file fs_vfstype [fs_mntopts - optional]

				final int first = line.indexOf(' ');
				if (first <= 0) continue;
				final int second = line.indexOf(' ', first + 1);
				if (second <= first) continue;

				final String fs_spec = line.substring(0, first);
				path = line.substring(first + 1, second);

				//fuse is used for internal storage
				final RootItem item = new RootItem(fs_spec, path,
					line.contains("fat") ||
						line.contains("fuse") ||
						//line.contains("ntfs") || //would this be safe?????
						//there are a few "interesting" mount points starting with /mnt/ ;)
						(path.startsWith("/mnt/") && !fs_spec.equals("tmpfs")));
				map.put(item.fs_specLC, item);
			}
			for (RootItem item : map.values()) {
				if (cancelled)
					break;
				if (item.isFileSystemTypeValid) {
					RootItem tmp, it = item;
					//try to get the actual path pointed by this item, using a
					//poor man's cycle prevention ;)
					i = 0;
					while (i < 4 && (tmp = map.get(it.pathLC)) != null) {
						it = tmp;
						i++;
					}
					try {
						//a few old phones erroneously return these 4 as mounted devices
						if (!it.pathLC.equals("/system") && !it.pathLC.equals("/data") && !it.pathLC.equals("/cache") && !it.pathLC.equals("/firmware"))
							addStorage(new File(it.path), true, internalCount, externalCount, usbCount, addedCount, addedPaths);
					} catch (Throwable ex) {
						ex.printStackTrace();
					}
				}
			}
		} catch (Throwable ex) {
			ex.printStackTrace();
		} finally {
			if (br != null) {
				try {
					br.close();
				} catch (Throwable ex) {
					ex.printStackTrace();
				}
			}
			if (isr != null) {
				try {
					isr.close();
				} catch (Throwable ex) {
					ex.printStackTrace();
				}
			}
			if (is != null) {
				try {
					is.close();
				} catch (Throwable ex) {
					ex.printStackTrace();
				}
			}
		}

		fetchRoot19(internalCount, externalCount, usbCount, addedCount, addedPaths);
	}

	private void fetchRoot19(int[] internalCount, int[] externalCount, int[] usbCount, int[] addedCount, String[] addedPaths) {
		//Massive workaround! This is a desperate attempt to fetch all possible directories
		//in newer CM and others...
		try {
			final File[] fs = context.getExternalFilesDirs(null);
			if (fs != null) {
				for (File f : fs) {
					if (f == null)
						continue;
					final String p = f.getAbsolutePath();
					final int a = p.indexOf("Android");
					if (a <= 0)
						continue;
					addStorage(new File(p.substring(0, a - 1)), true, internalCount, externalCount, usbCount, addedCount, addedPaths);
				}
			}
		} catch (Throwable ex) {
			ex.printStackTrace();
		}
	}

	private void fetchArtists() {
		final String fakeRoot = FileSt.FAKE_PATH_ROOT + context.getText(R.string.artists) + FileSt.FAKE_PATH_SEPARATOR;
		final String root = FileSt.ARTIST_ROOT + File.separator;
		//apparently a few devices don't like these members, so I converted them to the hardcoded version!
		final String[] proj = { "_id", "artist", "number_of_albums", "number_of_tracks" };
		final Cursor c = context.getContentResolver().query(Uri.parse("content://media/external/audio/artists"), proj, null, null, null);
		//
		//Despite its name, EXTERNAL_CONTENT_URI also comprises the internal storage
		//(at least it does so in all devices I have tested!)
		//
		if (c == null) {
			count = 0;
			files = new FileSt[0];
			return;
		}
		final TypedRawArrayList<FileSt> tmp = new TypedRawArrayList<>(FileSt.class, 64);
		while (c.moveToNext()) {
			if (cancelled) {
				count = 0;
				c.close();
				return;
			}
			String name = c.getString(1);
			if (name == null || name.equals("<unknown>"))
				name = unknownArtist;
			final long id = c.getLong(0);
			final FileSt f = new FileSt(root + id + fakeRoot + name, name, FileSt.TYPE_ARTIST);
			f.artistIdForAlbumArt = id;
			f.albums = c.getInt(2);
			f.tracks = c.getInt(3);
			tmp.add(f);
		}
		c.close();

		count = tmp.size();
		files = tmp.getRawArray();
		ArraySorter.sort(files, 0, count, (a, b) -> {
			if (a.name == unknownArtist)
				return -1;
			else if (b.name == unknownArtist)
				return 1;
			return a.name.compareToIgnoreCase(b.name);
		});
	}

	private void fetchAlbums(String path) {
		final String artist;
		final String fakeRoot;
		final String root;
		if (path == null) {
			artist = null;
			fakeRoot = FileSt.FAKE_PATH_ROOT + context.getText(R.string.albums) + FileSt.FAKE_PATH_SEPARATOR;
			root = FileSt.ALBUM_ROOT + File.separator;
		} else {
			final int fakePathIdx = path.indexOf(FileSt.FAKE_PATH_ROOT_CHAR);
			final String realPath = path.substring(0, fakePathIdx);
			final String fakePath = path.substring(fakePathIdx);
			artist = realPath.substring(realPath.lastIndexOf(File.separatorChar) + 1);
			fakeRoot = fakePath + FileSt.FAKE_PATH_SEPARATOR;
			root = realPath + File.separator;
		}
		//apparently a few devices don't like these members, so I converted them to the hardcoded version!
		final String[] proj = {
			//WHY, Android???? WHY?!?!?!?!?!?!?!
			(artist != null && Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) ? "album_id" : "_id",
			"album", "numsongs" };
		final Cursor c = context.getContentResolver().query(Uri.parse((artist == null) ?
			"content://media/external/audio/albums" :
			"content://media/external/audio/artists/" + artist + "/albums"), proj, null, null, null);
		if (c == null) {
			count = 0;
			files = new FileSt[0];
			return;
		}
		final TypedRawArrayList<FileSt> tmp = new TypedRawArrayList<>(FileSt.class, 64);
		while (c.moveToNext()) {
			if (cancelled) {
				count = 0;
				c.close();
				return;
			}
			String name = c.getString(1);
			if (name == null || name.equals("<unknown>"))
				name = unknownArtist;
			final long id = c.getLong(0);
			final FileSt f = new FileSt(root + id + fakeRoot + name, name, id);
			f.tracks = c.getInt(2);
			tmp.add(f);
		}
		c.close();

		count = tmp.size();
		files = tmp.getRawArray();
		ArraySorter.sort(files, 0, count, this);
	}

	private void fetchTracks(String path) {
		final int fakePathIdx = path.indexOf(FileSt.FAKE_PATH_ROOT_CHAR);
		final String realPath = path.substring(0, fakePathIdx);
		final int albumIdIdx = realPath.lastIndexOf(File.separatorChar) + 1;
		final String artist = ((realPath.charAt(0) == FileSt.ARTIST_ROOT_CHAR) ? realPath.substring(2, albumIdIdx - 1) : null);
		final String album = realPath.substring(albumIdIdx);
		//apparently a few devices don't like these members, so I converted them to the hardcoded version!
		final String[] proj = { "_data", "title", "track" };
		final Cursor c = context.getContentResolver().query(
			Uri.parse("content://media/external/audio/media"), proj,
			(artist == null) ?
				"album_id=?" :
				"album_id=? AND artist_id=?",
			(artist == null) ?
				new String[] { album } :
				new String[] { album, artist },
			null);
		if (c == null) {
			count = 0;
			files = new FileSt[0];
			return;
		}
		final TypedRawArrayList<FileSt> tmp = new TypedRawArrayList<>(FileSt.class, 64);
		while (c.moveToNext()) {
			if (cancelled) {
				count = 0;
				c.close();
				return;
			}
			//temporarily use tracks as the song's track number ;)
			final FileSt file = new FileSt(c.getString(0), c.getString(1), 0);
			file.tracks = c.getInt(2);
			tmp.add(file);
		}
		c.close();

		count = tmp.size();
		files = tmp.getRawArray();
		ArraySorter.sort(files, 0, count, (a, b) -> {
			if (a.tracks != b.tracks)
				return a.tracks - b.tracks;
			return a.name.compareToIgnoreCase(b.name);
		});
	}

	@SuppressWarnings("UnusedAssignment")
	private void fetchFiles(String path) {
		if (cancelled) {
			count = 0;
			return;
		}
		int i;
		File root = new File((path.charAt(path.length() - 1) == File.separatorChar) ? path : (path + File.separator));
		File[] files = root.listFiles();
		if (files == null || files.length == 0) {
			if (this.files == null)
				this.files = new FileSt[0];
			return;
		}
		final int l = count;
		ensureCapacity(count + files.length);
		for (i = 0; i < files.length; i++) {
			if (cancelled) {
				count = 0;
				return;
			}
			if (!accept(files[i]))
				continue;
			this.files[count] = new FileSt(files[i]);
			count++;
			files[i] = null;
		}
		files = null; //help the garbage collector
		final int e = count;
		ArraySorter.sort(this.files, l, e - l, this);
		if (!recursive)
			return;
		for (i = l; i < e; i++) {
			if (cancelled) {
				count = 0;
				return;
			}
			if (this.files[i].isDirectory)
				fetchFiles(this.files[i].path);
		}
	}

	@SuppressWarnings("StringEquality")
	private void computeSections() {
		if (count < 1) {
			sections = null;
			sectionPositions = null;
			return;
		}
		int sectionIdx = 0, i = 1, currentCount = 1;
		int[] charCount = new int[100]; //no more than 100 groups allowed
		int[] pos = new int[100];
		char[] chars = new char[100];
		char current, last = (char)Character.toUpperCase((int)files[0].name.charAt(0));
		if (last < '@' || files[0].name == unknownArtist)
			last = '#';
		chars[0] = last;
		pos[0] = 0;
		while (i < count && sectionIdx < 100) {
			current = (char)Character.toUpperCase((int)files[i].name.charAt(0));
			if (current < '@')
				current = '#';
			if (current != last) {
				charCount[sectionIdx] = currentCount;
				sectionIdx++;
				currentCount = 1;
				last = current;
				if (sectionIdx < 100) {
					chars[sectionIdx] = last;
					pos[sectionIdx] = i;
				}
			} else {
				currentCount++;
			}
			i++;
		}
		if (currentCount != 0 && sectionIdx < 100) {
			charCount[sectionIdx] = currentCount;
			sectionIdx++;
		}
		//we must not create more than 28 sections
		if (sectionIdx > 28) {
			//sort by charCount (ignoring the first section, which is always included)
			//a insertion-sort-like sort should do it :)
			for (i = 2; i < sectionIdx; i++) {
				final int c = charCount[i];
				final int p = pos[i];
				final char ch = chars[i];
				int j = i - 1;
				//ignore section 0
				while (j > 0 && c > charCount[j]) {
					charCount[j + 1] = charCount[j];
					pos[j + 1] = pos[j];
					chars[j + 1] = chars[j];
					charCount[j] = c;
					pos[j] = p;
					chars[j] = ch;
					j--;
				}
			}
			sectionIdx = 28;
			//now we take the first 28 sections, and sort them by pos
			for (i = 2; i < 28; i++) {
				final int p = pos[i];
				final char ch = chars[i];
				int j = i - 1;
				//ignore section 0
				while (j > 0 && p < pos[j]) {
					pos[j + 1] = pos[j];
					chars[j + 1] = chars[j];
					pos[j] = p;
					chars[j] = ch;
					j--;
				}
			}
		}
		sections = new String[sectionIdx];
		sectionPositions = new int[sectionIdx];
		for (i = sectionIdx - 1; i >= 0; i--) {
			sections[i] = Character.toString(chars[i]);
			sectionPositions[i] = pos[i];
		}
	}

	@Override
	public int compare(FileSt a, FileSt b) {
		if (a.isDirectory == b.isDirectory)
			return a.name.compareToIgnoreCase(b.name);
		return (a.isDirectory ? -1 : 1);
	}

	public void cancel() {
		cancelled = true;
		if (thread != null && thread.isAlive()) {
			try {
				thread.interrupt();
			} catch (Throwable ex) {
				// Just ignore...
			}
		}
	}

	@Override
	public void run() {
		if (Looper.getMainLooper().getThread() == Thread.currentThread()) {
			thread = null;
			if (listener != null && !cancelled)
				listener.onFilesFetched(this, notifyE);
			listener = null;
			notifyE = null;
			return;
		}
		Throwable e = null;
		try {
			if (path == null || path.isEmpty()) {
				fetchRoot();
			} else if (path.charAt(0) == FileSt.ARTIST_ROOT_CHAR) {
				if (path.startsWith(FileSt.ARTIST_PREFIX)) {
					fetchArtists();
					computeSections();
				} else {
					final int p1 = path.indexOf(File.separatorChar);
					final int p2 = path.lastIndexOf(File.separatorChar, path.indexOf(FileSt.FAKE_PATH_ROOT_CHAR));
					if (p2 != p1) {
						fetchTracks(path);
					} else {
						fetchAlbums(path);
						//we actually need to fetch all tracks from all this artist's albums...
						final FileSt[] albums = files;
						final TypedRawArrayList<FileSt> tracks = new TypedRawArrayList<>(FileSt.class, albums.length * 11);
						for (int i = 0; i < albums.length && albums[i] != null; i++) {
							if (cancelled) {
								count = 0;
								tracks.clear();
								break;
							}
							try {
								fetchTracks(albums[i].path);
								if (files != null && count > 0) {
									tracks.ensureCapacity(tracks.size() + count);
									albums[i].specialType = FileSt.TYPE_ALBUM_ITEM;
									tracks.add(albums[i]);
									for (int j = 0; j < count; j++) {
										tracks.add(files[j]);
										files[j] = null;
									}
									files = null;
								}
							} catch (Throwable ex) {
								e = ex;
							}
							albums[i] = null;
						}
						if (!tracks.isEmpty()) {
							//ignore any errors if at least one track was fetched
							e = null;
							count = tracks.size();
							files = tracks.getRawArray();
						} else {
							count = 0;
							if (files == null)
								files = new FileSt[0];
						}
					}
				}
			} else if (path.charAt(0) == FileSt.ALBUM_ROOT_CHAR) {
				if (path.startsWith(FileSt.ALBUM_PREFIX)) {
					fetchAlbums(null);
					computeSections();
				} else {
					fetchTracks(path);
				}
			} else {
				fetchFiles(path);
				computeSections();
			}
		} catch (Throwable ex) {
			e = ex;
		}
		if (!cancelled) {
			if (listener != null) {
				if (listenerHandler != null) {
					notifyE = e;
					listenerHandler.post(this);
				} else {
					listener.onFilesFetched(this, e);
					listener = null;
				}
			} else {
				notifyE = e;
			}
		}
	}
}
