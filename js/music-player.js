/**
 * music-player.js
 * 侧边栏音乐播放器：支持音频直链与视频媒体直链（视频仅输出声音）。
 */
(function(root) {
    'use strict';

    const AUDIO_EXTENSION = /\.(?:mp3|ogg|oga|wav|m4a|aac|flac|opus)(?:[?#].*)?$/i;
    const VIDEO_EXTENSION = /\.(?:mp4|webm|m4v|mov|ogv)(?:[?#].*)?$/i;
    const ALLOWED_TYPES = new Set(['auto', 'audio', 'video']);

    function normalizeType(type) {
        const value = String(type || 'auto').trim().toLowerCase();
        return ALLOWED_TYPES.has(value) ? value : 'auto';
    }

    function isThirdPartyVideoPage(url) {
        try {
            const parsed = new URL(url, 'https://jkk.local/');
            const host = parsed.hostname.toLowerCase().replace(/^www\./, '');
            return host === 'youtu.be' ||
                host.endsWith('youtube.com') ||
                host === 'b23.tv' ||
                host.endsWith('bilibili.com');
        } catch (error) {
            return false;
        }
    }

    function isSafeMediaUrl(url) {
        try {
            const parsed = new URL(url, 'https://jkk.local/');
            return parsed.protocol === 'http:' || parsed.protocol === 'https:';
        } catch (error) {
            return false;
        }
    }

    function detectSource(url, declaredType) {
        const value = String(url || '').trim();
        const type = normalizeType(declaredType);

        if (!value || !isSafeMediaUrl(value)) {
            return { kind: 'invalid', url: value, reason: 'invalid-url' };
        }
        if (isThirdPartyVideoPage(value)) {
            return { kind: 'unsupported', url: value, reason: 'video-page' };
        }
        if (type === 'video') {
            return { kind: 'video', url: value, reason: 'declared' };
        }
        if (type === 'audio') {
            return { kind: 'audio', url: value, reason: 'declared' };
        }
        if (VIDEO_EXTENSION.test(value)) {
            return { kind: 'video', url: value, reason: 'extension' };
        }
        if (AUDIO_EXTENSION.test(value)) {
            return { kind: 'audio', url: value, reason: 'extension' };
        }
        return { kind: 'audio', url: value, reason: 'fallback' };
    }

    function normalizeSong(song, index) {
        const source = song && typeof song === 'object' ? song : {};
        return {
            name: String(source.name || '').trim() || ('TRACK ' + String((index || 0) + 1).padStart(2, '0')),
            url: String(source.url || '').trim(),
            type: normalizeType(source.type)
        };
    }

    function validateSong(song) {
        const normalized = normalizeSong(song, 0);
        if (!String(song && song.name || '').trim()) {
            return { valid: false, message: '请填写曲名。', song: normalized };
        }
        if (!normalized.url) {
            return { valid: false, message: '请填写媒体 URL。', song: normalized };
        }
        const source = detectSource(normalized.url, normalized.type);
        if (source.kind === 'invalid') {
            return { valid: false, message: '媒体 URL 格式无效。', song: normalized, source };
        }
        if (source.kind === 'unsupported') {
            return {
                valid: false,
                message: '请使用音频或视频文件直链，不要填写 YouTube / Bilibili 的普通页面链接。',
                song: normalized,
                source
            };
        }
        return { valid: true, message: '', song: normalized, source };
    }

    class MusicPlayer {
        constructor(element) {
            this.element = element;
            this.audio = element.querySelector('#musicAudio');
            this.video = element.querySelector('#musicVideo');
            this.title = element.querySelector('#musicTitle');
            this.status = element.querySelector('#musicStatus');
            this.sourceLabel = element.querySelector('#musicSource');
            this.counter = element.querySelector('#musicCounter');
            this.progress = element.querySelector('#musicProgress');
            this.prevButton = element.querySelector('#musicPrev');
            this.playButton = element.querySelector('#musicPlay');
            this.nextButton = element.querySelector('#musicNext');
            this.randomButton = element.querySelector('#musicRandom');
            this.loopButton = element.querySelector('#musicLoop');

            this.playlist = [];
            this.currentIndex = 0;
            this.loadedIndex = -1;
            this.currentMedia = null;
            this.random = false;
            this.loop = false;
            this.bound = false;
            this.switching = false;
        }

        async loadPlaylist(url) {
            this.setStatus('LOADING');
            try {
                const response = await root.fetch(url, { cache: 'no-store' });
                if (!response.ok) throw new Error('HTTP ' + response.status);
                const data = await response.json();
                this.setPlaylist(data.songs || []);
            } catch (error) {
                this.setPlaylist([]);
                this.setStatus('LIST ERROR');
                this.element.classList.add('has-error');
                if (root.console) root.console.warn('无法加载音乐列表', error);
            }
        }

        setPlaylist(songs) {
            this.stopAll(true);
            this.playlist = (Array.isArray(songs) ? songs : [])
                .map(normalizeSong)
                .filter(song => song.url)
                .slice(0, 10);
            this.currentIndex = 0;
            this.loadedIndex = -1;
            this.currentMedia = null;
            this.element.classList.remove('has-error', 'is-playing', 'is-loading');
            this.bind();
            this.renderTrack();
            this.syncControls();
        }

        bind() {
            if (this.bound) return;
            this.bound = true;

            this.playButton.addEventListener('click', () => this.togglePlay());
            this.prevButton.addEventListener('click', () => this.changeTrack(-1, true));
            this.nextButton.addEventListener('click', () => this.changeTrack(1, true));
            this.randomButton.addEventListener('click', () => {
                this.random = !this.random;
                this.syncControls();
            });
            this.loopButton.addEventListener('click', () => {
                this.loop = !this.loop;
                this.audio.loop = this.loop;
                this.video.loop = this.loop;
                this.syncControls();
            });

            [this.audio, this.video].forEach(media => {
                media.addEventListener('loadstart', () => {
                    if (media !== this.currentMedia || this.switching) return;
                    this.setStatus('LOADING');
                    this.element.classList.add('is-loading');
                });
                media.addEventListener('loadedmetadata', () => {
                    if (media !== this.currentMedia) return;
                    this.element.classList.remove('is-loading', 'has-error');
                    if (media.paused) this.setStatus('READY');
                    this.updateProgress();
                });
                media.addEventListener('waiting', () => {
                    if (media !== this.currentMedia) return;
                    this.setStatus('BUFFERING');
                    this.element.classList.add('is-loading');
                });
                media.addEventListener('playing', () => {
                    if (media !== this.currentMedia) return;
                    this.setStatus('PLAYING');
                    this.element.classList.remove('is-loading', 'has-error');
                    this.element.classList.add('is-playing');
                    this.syncPlayButton(true);
                });
                media.addEventListener('pause', () => {
                    if (media !== this.currentMedia || this.switching || media.ended) return;
                    this.setStatus('PAUSED');
                    this.element.classList.remove('is-playing', 'is-loading');
                    this.syncPlayButton(false);
                });
                media.addEventListener('timeupdate', () => {
                    if (media === this.currentMedia) this.updateProgress();
                });
                media.addEventListener('ended', () => {
                    if (media !== this.currentMedia || this.loop) return;
                    this.changeTrack(1, true);
                });
                media.addEventListener('error', () => {
                    if (media !== this.currentMedia || this.switching || !media.getAttribute('src')) return;
                    this.setStatus('LOAD ERROR');
                    this.element.classList.remove('is-playing', 'is-loading');
                    this.element.classList.add('has-error');
                    this.syncPlayButton(false);
                });
            });
        }

        async togglePlay() {
            if (!this.playlist.length) return;
            if (this.currentMedia && !this.currentMedia.paused) {
                this.currentMedia.pause();
                return;
            }
            await this.playCurrent();
        }

        async playCurrent() {
            const media = this.prepareCurrent();
            if (!media) return;
            try {
                await media.play();
            } catch (error) {
                this.setStatus(error && error.name === 'NotAllowedError' ? 'CLICK PLAY' : 'LOAD ERROR');
                this.element.classList.remove('is-playing', 'is-loading');
                this.element.classList.add('has-error');
                this.syncPlayButton(false);
            }
        }

        changeTrack(direction, autoplay) {
            if (!this.playlist.length) return;
            if (this.random && this.playlist.length > 1) {
                let nextIndex = this.currentIndex;
                while (nextIndex === this.currentIndex) {
                    nextIndex = Math.floor(Math.random() * this.playlist.length);
                }
                this.currentIndex = nextIndex;
            } else {
                this.currentIndex = (this.currentIndex + direction + this.playlist.length) % this.playlist.length;
            }
            this.loadedIndex = -1;
            this.renderTrack();
            if (autoplay) this.playCurrent();
        }

        prepareCurrent() {
            if (!this.playlist.length) return null;
            if (this.loadedIndex === this.currentIndex && this.currentMedia) return this.currentMedia;

            this.stopAll(true);
            const song = this.playlist[this.currentIndex];
            const source = detectSource(song.url, song.type);
            this.renderTrack(source);

            if (source.kind === 'invalid' || source.kind === 'unsupported') {
                this.setStatus(source.kind === 'unsupported' ? 'URL BLOCKED' : 'BAD URL');
                this.element.classList.add('has-error');
                return null;
            }

            this.currentMedia = source.kind === 'video' ? this.video : this.audio;
            this.currentMedia.loop = this.loop;
            this.currentMedia.src = source.url;
            this.loadedIndex = this.currentIndex;
            this.setStatus('READY');
            this.currentMedia.load();
            return this.currentMedia;
        }

        stopAll(clearSources) {
            this.switching = true;
            [this.audio, this.video].forEach(media => {
                media.pause();
                try {
                    media.currentTime = 0;
                } catch (error) {
                    // 尚未载入元数据时，部分浏览器不允许设置播放位置。
                }
                if (clearSources) {
                    media.removeAttribute('src');
                    media.load();
                }
            });
            this.switching = false;
            this.progress.style.width = '0%';
        }

        renderTrack(source) {
            const total = this.playlist.length;
            if (!total) {
                this.title.textContent = 'NO TRACKS // EDIT MUSIC-LIST';
                this.counter.textContent = '00/00';
                this.sourceLabel.textContent = '--';
                this.setStatus('STANDBY');
                return;
            }

            const song = this.playlist[this.currentIndex];
            const resolved = source || detectSource(song.url, song.type);
            this.title.textContent = song.name;
            this.counter.textContent =
                String(this.currentIndex + 1).padStart(2, '0') + '/' +
                String(total).padStart(2, '0');
            this.sourceLabel.textContent =
                resolved.kind === 'video' ? 'VIDEO // AUDIO' :
                resolved.kind === 'audio' ? 'AUDIO' : 'UNSUPPORTED';
            if (this.loadedIndex !== this.currentIndex) this.setStatus('READY');
        }

        setStatus(value) {
            this.status.textContent = value;
        }

        updateProgress() {
            if (!this.currentMedia || !Number.isFinite(this.currentMedia.duration) || this.currentMedia.duration <= 0) {
                this.progress.style.width = '0%';
                return;
            }
            const percent = Math.min(100, Math.max(0, (this.currentMedia.currentTime / this.currentMedia.duration) * 100));
            this.progress.style.width = percent.toFixed(2) + '%';
        }

        syncControls() {
            const disabled = this.playlist.length === 0;
            [this.prevButton, this.playButton, this.nextButton, this.randomButton, this.loopButton]
                .forEach(button => { button.disabled = disabled; });
            this.randomButton.classList.toggle('active', this.random);
            this.loopButton.classList.toggle('active', this.loop);
            this.randomButton.setAttribute('aria-pressed', String(this.random));
            this.loopButton.setAttribute('aria-pressed', String(this.loop));
            this.syncPlayButton(Boolean(this.currentMedia && !this.currentMedia.paused));
        }

        syncPlayButton(playing) {
            this.playButton.textContent = playing ? 'Ⅱ' : '▶';
            this.playButton.setAttribute('aria-label', playing ? '暂停' : '播放');
            this.playButton.title = playing ? '暂停' : '播放';
        }
    }

    const API = Object.freeze({
        detectSource,
        normalizeSong,
        normalizeType,
        validateSong,
        MusicPlayer
    });

    root.JKKMusic = API;
    if (typeof module !== 'undefined' && module.exports) module.exports = API;
})(typeof window !== 'undefined' ? window : globalThis);
