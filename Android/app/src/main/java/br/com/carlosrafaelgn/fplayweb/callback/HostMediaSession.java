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
// A lot of this code came from my other project: https://github.com/carlosrafaelgn/FPlayAndroid

package br.com.carlosrafaelgn.fplayweb.callback;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationChannelGroup;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.graphics.drawable.Icon;
import android.media.MediaMetadata;
import android.media.session.MediaSession;
import android.media.session.PlaybackState;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.os.SystemClock;
import android.support.annotation.NonNull;
import android.view.KeyEvent;
import android.webkit.WebView;

import br.com.carlosrafaelgn.fplayweb.MainActivity;
import br.com.carlosrafaelgn.fplayweb.MainService;
import br.com.carlosrafaelgn.fplayweb.R;
import br.com.carlosrafaelgn.fplayweb.WebViewHost;

public final class HostMediaSession {
	// https://developer.android.com/guide/topics/media-apps/media-apps-overview
	// https://developer.android.com/guide/topics/media-apps/audio-app/building-a-mediabrowserservice
	// https://developer.android.com/guide/topics/media-apps/audio-app/building-a-mediabrowserservice#mediastyle-notifications

	private static final String NONE = "-";

	private static final String CHANNEL_GROUP_ID = "fplaywebg";
	private static final String CHANNEL_ID = "fplayweb";

	private static final int MSG_HEADSET_HOOK_TIMER = 0x0100;

	private final WebViewHost webViewHost;
	private final Handler handler;

	private boolean paused;
	private boolean loading;
	private boolean hasSong;
	private int headsetHookPressCount;
	private String lastTitle, lastArtist;

	private MediaSession mediaSession;
	private MediaMetadata.Builder mediaSessionMetadataBuilder;
	private PlaybackState.Builder mediaSessionPlaybackStateBuilder;
	private NotificationManager notificationManager;
	private PendingIntent intentActivity, intentPrev, intentPlayPause, intentNext, intentExit;
	private Notification.Action actionPrev, actionPause, actionPlay, actionNext, actionExit;
	private Notification notification;

	public HostMediaSession(WebViewHost webViewHost) {
		this.webViewHost = webViewHost;
		handler = new Handler(Looper.getMainLooper(), msg -> {
			if (msg.what == MSG_HEADSET_HOOK_TIMER)
				processHeadsetHookTimer();
			return true;
		});

		paused = true;
		lastTitle = NONE;
		lastArtist = NONE;

		// These intents are used regardless of the version
		Intent intent = new Intent(webViewHost.application, MainActivity.class);
		intent.setFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP);
		intentActivity = PendingIntent.getActivity(webViewHost.application, 0, intent, PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);

		intent = new Intent(webViewHost.application, IntentReceiver.class);
		intent.setAction(WebViewHost.ACTION_EXIT);
		intentExit = PendingIntent.getBroadcast(webViewHost.application, 0, intent, PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);

		try {
			mediaSessionMetadataBuilder = new MediaMetadata.Builder();
			mediaSessionPlaybackStateBuilder = new PlaybackState.Builder();
			mediaSessionPlaybackStateBuilder.setActions(
				PlaybackState.ACTION_PLAY_FROM_MEDIA_ID |
				PlaybackState.ACTION_SKIP_TO_PREVIOUS |
				PlaybackState.ACTION_REWIND |
				PlaybackState.ACTION_PAUSE |
				PlaybackState.ACTION_PLAY |
				PlaybackState.ACTION_PLAY_PAUSE |
				PlaybackState.ACTION_STOP |
				PlaybackState.ACTION_FAST_FORWARD |
				PlaybackState.ACTION_SKIP_TO_NEXT |
				PlaybackState.ACTION_SEEK_TO
			);

			if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU)
				mediaSessionPlaybackStateBuilder.addCustomAction(WebViewHost.ACTION_EXIT, webViewHost.application.getText(R.string.exit).toString(), R.drawable.ic_exit);

			mediaSession = new MediaSession(webViewHost.application, "FPlayWeb");
			mediaSession.setCallback(new MediaSession.Callback() {
				@Override
				public boolean onMediaButtonEvent(@NonNull Intent mediaButtonIntent) {
					final Object o = mediaButtonIntent.getParcelableExtra(Intent.EXTRA_KEY_EVENT);
					if (!(o instanceof KeyEvent))
						return false;
					final KeyEvent e = (KeyEvent)o;
					if (e.getAction() == KeyEvent.ACTION_DOWN)
						handleMediaButton(e.getKeyCode());
					return true;
				}

				@Override
				public void onPlayFromMediaId(String mediaId, Bundle extras) {
					try {
						if (mediaId != null && !mediaId.isEmpty())
							skipToQueueItem(Long.parseLong(mediaId));
					} catch (Throwable ex) {
						// Just ignore...
					}
				}

				@Override
				public void onSkipToQueueItem(long id) {
					skipToQueueItem(id);
				}

				@Override
				public void onSkipToPrevious() {
					handleMediaButton(KeyEvent.KEYCODE_MEDIA_PREVIOUS);
				}

				@Override
				public void onRewind() {
					handleMediaButton(KeyEvent.KEYCODE_MEDIA_REWIND);
				}

				@Override
				public void onPause() {
					handleMediaButton(KeyEvent.KEYCODE_MEDIA_PAUSE);
				}

				@Override
				public void onPlay() {
					handleMediaButton(KeyEvent.KEYCODE_MEDIA_PLAY);
				}

				@Override
				public void onStop() {
					handleMediaButton(KeyEvent.KEYCODE_MEDIA_STOP);
				}

				@Override
				public void onFastForward() {
					handleMediaButton(KeyEvent.KEYCODE_MEDIA_FAST_FORWARD);
				}

				@Override
				public void onSkipToNext() {
					handleMediaButton(KeyEvent.KEYCODE_MEDIA_NEXT);
				}

				@Override
				public void onSeekTo(long pos) {
					seekTo(pos);
				}

				@Override
				public void onCustomAction(@NonNull String action, Bundle extras) {
					// https://developer.android.com/media/implement/surfaces/mobile#responding_to_playbackstate_actions
					if (action.equals(WebViewHost.ACTION_EXIT)) {
						final WebView webView = webViewHost.webView;

						if (webView == null)
							return;

						webView.evaluateJavascript("App.player && App.exit()", null);
					}
				}
			});
			mediaSession.setSessionActivity(intentActivity);
			mediaSession.setPlaybackState(mediaSessionPlaybackStateBuilder.setState(PlaybackState.STATE_STOPPED, 0, 1, SystemClock.elapsedRealtime()).build());
			mediaSession.setActive(true);
		} catch (Throwable ex) {
			ex.printStackTrace();
		}

		if (Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU) {
			intent = new Intent(webViewHost.application, IntentReceiver.class);
			intent.setAction(WebViewHost.ACTION_PREV);
			intentPrev = PendingIntent.getBroadcast(webViewHost.application, 0, intent, PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);

			intent = new Intent(webViewHost.application, IntentReceiver.class);
			intent.setAction(WebViewHost.ACTION_PLAY_PAUSE);
			intentPlayPause = PendingIntent.getBroadcast(webViewHost.application, 0, intent, PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);

			intent = new Intent(webViewHost.application, IntentReceiver.class);
			intent.setAction(WebViewHost.ACTION_NEXT);
			intentNext = PendingIntent.getBroadcast(webViewHost.application, 0, intent, PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);

			actionPrev = new Notification.Action.Builder(Icon.createWithResource(webViewHost.application, R.drawable.ic_prev), webViewHost.application.getText(R.string.previous), intentPrev).build();
			actionPause = new Notification.Action.Builder(Icon.createWithResource(webViewHost.application, R.drawable.ic_pause), webViewHost.application.getText(R.string.pause), intentPlayPause).build();
			actionPlay = new Notification.Action.Builder(Icon.createWithResource(webViewHost.application, R.drawable.ic_play), webViewHost.application.getText(R.string.play), intentPlayPause).build();
			actionNext = new Notification.Action.Builder(Icon.createWithResource(webViewHost.application, R.drawable.ic_next), webViewHost.application.getText(R.string.next), intentNext).build();
			actionExit = new Notification.Action.Builder(Icon.createWithResource(webViewHost.application, R.drawable.ic_exit), webViewHost.application.getText(R.string.exit), intentExit).build();
		}

		notificationManager = (NotificationManager)webViewHost.application.getSystemService(Context.NOTIFICATION_SERVICE);

		final String appName = webViewHost.application.getText(R.string.app_name).toString();
		notificationManager.createNotificationChannelGroup(new NotificationChannelGroup(CHANNEL_GROUP_ID, appName));
		final NotificationChannel notificationChannel = new NotificationChannel(CHANNEL_ID, appName, NotificationManager.IMPORTANCE_LOW);
		notificationChannel.setGroup(CHANNEL_GROUP_ID);
		notificationChannel.enableLights(false);
		notificationChannel.enableVibration(false);
		notificationChannel.setLockscreenVisibility(Notification.VISIBILITY_PUBLIC);
		notificationChannel.setShowBadge(false);
		notificationManager.createNotificationChannel(notificationChannel);

		refreshNotification();

		webViewHost.application.startForegroundService(new Intent(webViewHost.application, MainService.class));
	}

	public Notification getNotification() {
		return notification;
	}

	private void refreshNotification() {
		if (notificationManager == null)
			return;

		final Notification.MediaStyle mediaStyle = new Notification.MediaStyle();
		if (mediaSession != null)
			mediaStyle.setMediaSession(mediaSession.getSessionToken());
		mediaStyle.setShowActionsInCompactView();

		final Notification.Builder builder = new Notification.Builder(webViewHost.application, CHANNEL_ID)
			.setSmallIcon(R.drawable.ic_notification)
			.setWhen(0)
			.setStyle(mediaStyle)
			.setContentTitle(lastTitle)
			.setSubText(lastArtist)
			.setColorized(false)
			// Apparently, the ongoing flag should be set to false for the delete intent to be sent
			// https://stackoverflow.com/q/74808095/3569421
			.setOngoing(false)
			.setContentIntent(intentActivity)
			.setDeleteIntent(intentExit);

		if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S)
			builder.setForegroundServiceBehavior(Notification.FOREGROUND_SERVICE_IMMEDIATE);

		if (Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU) {
			builder
				.addAction(actionPrev)
				.addAction(paused ? actionPlay : actionPause)
				.addAction(actionNext)
				.addAction(actionExit);

			mediaStyle.setShowActionsInCompactView(0, 1, 2);
		}

		try {
			notificationManager.notify(1, notification = builder.build());
		} catch (Throwable ex) {
			// Why the *rare* android.os.TransactionTooLargeException?
			// What to do?!?!
		}
	}

	private void resetHeadsetHook() {
		headsetHookPressCount = 0;
		handler.removeMessages(MSG_HEADSET_HOOK_TIMER);
	}

	private void processHeadsetHookTimer() {
		final WebView webView = webViewHost.webView;

		if (mediaSession == null || webView == null)
			return;

		final int headsetHookPressCount = this.headsetHookPressCount;
		resetHeadsetHook();

		switch (headsetHookPressCount) {
		case 1:
			webView.evaluateJavascript("App.player && App.player.playPause()", null);
			break;
		case 2:
			webView.evaluateJavascript("App.player && App.player.next()", null);
			break;
		default:
			webView.evaluateJavascript("App.player && App.player.previous()", null);
			break;
		}
	}

	private void setPlaybackState(long lengthMS, double positionS) {
		if (mediaSession == null)
			return;

		try {
			mediaSession.setPlaybackState(mediaSessionPlaybackStateBuilder.setState(hasSong ? (loading ? PlaybackState.STATE_BUFFERING : (paused ? PlaybackState.STATE_PAUSED : PlaybackState.STATE_PLAYING)) : PlaybackState.STATE_STOPPED, Math.max(0, Math.min(lengthMS, positionS > 0 ? (long)(positionS * 1000.0) : 0)), 1, SystemClock.elapsedRealtime()).build());
		} catch (Throwable ex) {
			ex.printStackTrace();
		}

		refreshNotification();
	}

	public void setPaused(boolean paused, long lengthMS, double positionS) {
		this.paused = paused;
		setPlaybackState(lengthMS, positionS);
	}

	public void setLoading(boolean loading, long lengthMS, double positionS) {
		this.loading = loading;
		setPlaybackState(lengthMS, positionS);
	}

	public void setMetadata(long id, String title, String artist, String album, int track, int year, long lengthMS, double positionS) {
		if (mediaSession == null)
			return;

		hasSong = (id > 0);
		try {
			if (id > 0) {
				lastTitle = title;
				lastArtist = artist;

				mediaSessionMetadataBuilder.putString(MediaMetadata.METADATA_KEY_MEDIA_ID, Long.toString(id));
				mediaSessionMetadataBuilder.putString(MediaMetadata.METADATA_KEY_TITLE, title);
				mediaSessionMetadataBuilder.putString(MediaMetadata.METADATA_KEY_ARTIST, artist);
				mediaSessionMetadataBuilder.putString(MediaMetadata.METADATA_KEY_ALBUM, album);
				mediaSessionMetadataBuilder.putLong(MediaMetadata.METADATA_KEY_TRACK_NUMBER, track);
				mediaSessionMetadataBuilder.putLong(MediaMetadata.METADATA_KEY_DURATION, lengthMS >= 0 ? lengthMS : 0);
				mediaSessionMetadataBuilder.putLong(MediaMetadata.METADATA_KEY_YEAR, year);
			} else {
				lastTitle = NONE;
				lastArtist = NONE;

				mediaSessionMetadataBuilder.putString(MediaMetadata.METADATA_KEY_MEDIA_ID, NONE);
				mediaSessionMetadataBuilder.putString(MediaMetadata.METADATA_KEY_TITLE, NONE);
				mediaSessionMetadataBuilder.putString(MediaMetadata.METADATA_KEY_ARTIST, NONE);
				mediaSessionMetadataBuilder.putString(MediaMetadata.METADATA_KEY_ALBUM, NONE);
				mediaSessionMetadataBuilder.putLong(MediaMetadata.METADATA_KEY_TRACK_NUMBER, 0);
				mediaSessionMetadataBuilder.putLong(MediaMetadata.METADATA_KEY_DURATION, 0);
				mediaSessionMetadataBuilder.putLong(MediaMetadata.METADATA_KEY_YEAR, 0);
			}
			mediaSession.setMetadata(mediaSessionMetadataBuilder.build());
		} catch (Throwable ex) {
			ex.printStackTrace();
		}
		setPlaybackState(lengthMS, positionS);
	}

	private void handleMediaButton(int keyCode) {
		final WebView webView = webViewHost.webView;

		if (webView == null)
			return;

		switch (keyCode) {
		// There are a few weird bluetooth headsets that despite having only one physical
		// play/pause button, will try to simulate individual PLAY and PAUSE events,
		// instead of sending the proper event PLAY_PAUSE... The problem is, they are not
		// always synchronized with the actual player state, and therefore, the user ends
		// up having to press that button twice for something to happen! :(
		case KeyEvent.KEYCODE_MEDIA_PLAY:
		case KeyEvent.KEYCODE_MEDIA_PLAY_PAUSE:
		case KeyEvent.KEYCODE_MEDIA_PAUSE:
		case KeyEvent.KEYCODE_BREAK:
		case KeyEvent.KEYCODE_CALL:
			webView.evaluateJavascript("App.player && App.player.playPause()", null);
			break;
		case KeyEvent.KEYCODE_HEADSETHOOK:
			handler.removeMessages(MSG_HEADSET_HOOK_TIMER);
			headsetHookPressCount++;
			if (headsetHookPressCount >= 3)
				processHeadsetHookTimer();
			else
				handler.sendEmptyMessageAtTime(MSG_HEADSET_HOOK_TIMER, SystemClock.uptimeMillis() + 500);
			break;
		case KeyEvent.KEYCODE_MEDIA_PREVIOUS:
			webView.evaluateJavascript("App.player && App.player.previous()", null);
			break;
		case KeyEvent.KEYCODE_MEDIA_REWIND:
			webView.evaluateJavascript("App.player && App.player.seekBackward()", null);
			break;
		case KeyEvent.KEYCODE_MEDIA_STOP:
			webView.evaluateJavascript("App.player && App.player.stop()", null);
			break;
		case KeyEvent.KEYCODE_MEDIA_FAST_FORWARD:
			webView.evaluateJavascript("App.player && App.player.seekForward()", null);
			break;
		case KeyEvent.KEYCODE_MEDIA_NEXT:
			webView.evaluateJavascript("App.player && App.player.next()", null);
			break;
		}
	}

	public void skipToQueueItem(long id) {
		final WebView webView = webViewHost.webView;

		if (webView != null && id > 0)
			webView.evaluateJavascript("App.player && App.player.playSongId(" + id + ")", null);
	}

	public void seekTo(long timeMS) {
		final WebView webView = webViewHost.webView;

		if (webView != null)
			webView.evaluateJavascript("App.player && App.player.seekTo(" + timeMS + ")", null);
	}

	public void destroy() {
		if (notificationManager == null)
			return;

		notification = null;

		webViewHost.application.stopService(new Intent(webViewHost.application, MainService.class));

		try {
			notificationManager.deleteNotificationChannel(CHANNEL_ID);
		} catch (Throwable ex) {
			// Just ignore...
		}

		try {
			notificationManager.deleteNotificationChannelGroup(CHANNEL_GROUP_ID);
		} catch (Throwable ex) {
			// Just ignore...
		}

		notificationManager = null;
		notification = null;

		intentActivity = null;
		intentPrev = null;
		intentPlayPause = null;
		intentNext = null;
		intentExit = null;

		actionPrev = null;
		actionPause = null;
		actionPlay = null;
		actionNext = null;
		actionExit = null;

		resetHeadsetHook();

		if (mediaSession != null) {
			try {
				mediaSession.setActive(false);
				mediaSession.setCallback(null);
				mediaSession.release();
			} catch (Throwable ex) {
				ex.printStackTrace();
			}
			mediaSession = null;
		}
		mediaSessionMetadataBuilder = null;
		mediaSessionPlaybackStateBuilder = null;
	}
}
