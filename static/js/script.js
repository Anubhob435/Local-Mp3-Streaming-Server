/**
 * Modern Music Streaming App - Enhanced JavaScript
 * Features: YouTube integration, local file streaming, real-time sync
 */

class MusicStreamingApp {
    constructor() {
        // Initialize Socket.IO
        this.socket = io();
        
        // Cache DOM elements
        this.initDOMElements();
        
        // Initialize app components
        this.initEventListeners();
        this.initAudioPlayer();
        this.initNavigation();
        
        // Load initial content
        this.loadSectionContent('local');
        
        // Setup Socket.IO handlers
        this.initSocketHandlers();
        
        console.log('🎵 MusicStream App initialized');
    }

    initDOMElements() {
        // Search elements
        this.searchInput = document.getElementById('searchInput');
        this.searchBtn = document.getElementById('searchBtn');
        
        // Audio player elements
        this.audioPlayer = document.getElementById('audioPlayer');
        this.playPauseBtn = document.getElementById('playPauseBtn');
        this.progressBar = document.getElementById('progressBar');
        this.progressFill = document.getElementById('progressFill');
        this.currentTimeDisplay = document.getElementById('currentTime');
        this.totalTimeDisplay = document.getElementById('totalTime');
        this.volumeSlider = document.getElementById('volumeSlider');
        this.muteBtn = document.getElementById('muteBtn');
        
        // Now playing elements
        this.nowPlayingTitle = document.getElementById('nowPlayingTitle');
        this.nowPlayingArtist = document.getElementById('nowPlayingArtist');
        this.nowPlayingThumbnail = document.getElementById('nowPlayingThumbnail');
        
        // Navigation elements
        this.navItems = document.querySelectorAll('.nav-item');
        this.contentSections = document.querySelectorAll('.content-section');
        
        // Additional control buttons
        this.shuffleBtn = document.getElementById('shuffleBtn');
        this.prevBtn = document.getElementById('prevBtn');
        this.nextBtn = document.getElementById('nextBtn');
        this.repeatBtn = document.getElementById('repeatBtn');
    }

    initEventListeners() {
        // Search functionality
        this.searchBtn?.addEventListener('click', () => this.performSearch());
        this.searchInput?.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.performSearch();
        });

        // Player controls
        this.playPauseBtn?.addEventListener('click', () => this.togglePlayPause());
        this.progressBar?.addEventListener('click', (e) => this.seekToPosition(e));
        this.volumeSlider?.addEventListener('input', () => this.updateVolume());
        this.muteBtn?.addEventListener('click', () => this.toggleMute());

        // Additional controls
        this.shuffleBtn?.addEventListener('click', () => this.toggleShuffle());
        this.prevBtn?.addEventListener('click', () => this.playPrevious());
        this.nextBtn?.addEventListener('click', () => this.playNext());
        this.repeatBtn?.addEventListener('click', () => this.toggleRepeat());

        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => this.handleKeyboardShortcuts(e));
    }

    initAudioPlayer() {
        if (!this.audioPlayer) return;

        // Audio event listeners
        this.audioPlayer.addEventListener('play', () => this.onAudioPlay());
        this.audioPlayer.addEventListener('pause', () => this.onAudioPause());
        this.audioPlayer.addEventListener('timeupdate', () => this.onTimeUpdate());
        this.audioPlayer.addEventListener('loadedmetadata', () => this.onMetadataLoaded());
        this.audioPlayer.addEventListener('ended', () => this.onAudioEnded());
        this.audioPlayer.addEventListener('error', (e) => this.onAudioError(e));
        this.audioPlayer.addEventListener('loadstart', () => this.onLoadStart());
        this.audioPlayer.addEventListener('canplay', () => this.onCanPlay());
    }

    initNavigation() {
        this.navItems.forEach(item => {
            item.addEventListener('click', () => {
                const section = item.dataset.section;
                this.switchSection(section);
                this.loadSectionContent(section);
            });
        });
    }

    initSocketHandlers() {
        this.socket.on('control', (data) => this.handleSocketControl(data));
        this.socket.on('connect', () => {
            console.log('🔗 Connected to server');
            this.showToast('Connected to server', 'success');
        });
        this.socket.on('disconnect', () => {
            console.log('❌ Disconnected from server');
            this.showToast('Disconnected from server', 'warning');
        });
    }

    // Navigation Methods
    switchSection(sectionName) {
        // Update active nav item
        this.navItems.forEach(nav => nav.classList.remove('active'));
        document.querySelector(`[data-section="${sectionName}"]`)?.classList.add('active');
        
        // Show corresponding section
        this.contentSections.forEach(sec => sec.classList.remove('active'));
        document.getElementById(sectionName)?.classList.add('active');
    }

    async loadSectionContent(section) {
        try {
            switch (section) {
                case 'local':
                    await this.loadLocalFiles();
                    break;
                case 'playlists':
                    await this.loadPlaylists();
                    break;
                case 'search':
                    // Search section is loaded dynamically
                    break;
                default:
                    console.log(`No specific loader for section: ${section}`);
            }
        } catch (error) {
            console.error(`Error loading section ${section}:`, error);
            this.showToast(`Error loading ${section}`, 'error');
        }
    }

    // Search Methods
    async performSearch() {
        const query = this.searchInput?.value.trim();
        if (!query) {
            this.showToast('Please enter a search term', 'warning');
            return;
        }

        // Switch to search section
        this.switchSection('search');
        
        const resultsContainer = document.getElementById('searchResults');
        if (!resultsContainer) return;

        resultsContainer.innerHTML = this.createLoadingHTML('Searching YouTube...');

        try {
            const response = await fetch(`/youtube/search?q=${encodeURIComponent(query)}&max_results=12`);
            const videos = await response.json();

            if (!response.ok || videos.error) {
                throw new Error(videos.error || 'Search failed');
            }

            if (videos.length === 0) {
                resultsContainer.innerHTML = this.createEmptyStateHTML('search', 'No results found', 'Try a different search term');
                return;
            }

            resultsContainer.innerHTML = this.createVideoGridHTML(videos);
            this.attachVideoCardListeners();

        } catch (error) {
            console.error('Search error:', error);
            resultsContainer.innerHTML = this.createErrorHTML(`Search failed: ${error.message}`);
        }
    }

    // Content Loading Methods
    async loadLocalFiles() {
        const container = document.getElementById('localFiles');
        if (!container) return;

        container.innerHTML = this.createLoadingHTML('Loading local files...');

        try {
            const response = await fetch('/mp3-list');
            const files = await response.json();

            if (files.length === 0) {
                container.innerHTML = this.createEmptyStateHTML('folder-open', 'No local files found', 'Add MP3 files to your server directory');
                return;
            }

            container.innerHTML = files.map(file => this.createFileItemHTML(file)).join('');
            this.attachFileItemListeners();

        } catch (error) {
            console.error('Error loading local files:', error);
            container.innerHTML = this.createErrorHTML(`Error loading files: ${error.message}`);
        }
    }

    async loadPlaylists() {
        const container = document.getElementById('playlistsContainer');
        if (!container) return;

        container.innerHTML = this.createLoadingHTML('Loading playlists...');

        try {
            const response = await fetch('/playlists');
            const playlists = await response.json();

            container.innerHTML = `
                <div class="video-grid">
                    ${playlists.map(playlist => this.createPlaylistCardHTML(playlist)).join('')}
                </div>
            `;

        } catch (error) {
            console.error('Error loading playlists:', error);
            container.innerHTML = this.createErrorHTML(`Error loading playlists: ${error.message}`);
        }
    }

    // Audio Playback Methods
    async playYouTubeAudio(videoId, title, channel, thumbnail) {
        try {
            this.showToast('Loading YouTube audio...', 'info');
            
            // Set loading state
            this.updateNowPlaying(title, channel, thumbnail);
            this.setPlayButtonLoading(true);
            
            // Try proxy streaming method first
            const streamUrl = `/youtube/stream/${videoId}`;
            
            try {
                const testResponse = await fetch(streamUrl, { method: 'HEAD' });
                if (testResponse.ok) {
                    await this.loadAndPlayAudio(streamUrl, () => {
                        this.showToast('Now playing from YouTube!', 'success');
                        this.emitControlAction('play', {
                            source: 'youtube',
                            videoId: videoId,
                            title: title,
                            channel: channel,
                            thumbnail: thumbnail
                        });
                    });
                    return;
                }
            } catch (streamError) {
                console.log('Proxy stream failed, trying direct URL method...');
            }
            
            // Fallback to direct URL method
            const response = await fetch(`/youtube/audio/${videoId}`);
            const data = await response.json();
            
            if (!response.ok || !data.success) {
                throw new Error(data.error || 'Failed to extract audio URL');
            }
            
            await this.loadAndPlayAudio(data.audio_url, () => {
                this.showToast('Now playing from YouTube!', 'success');
                this.emitControlAction('play', {
                    source: 'youtube',
                    videoId: videoId,
                    title: title,
                    channel: channel,
                    thumbnail: thumbnail
                });
            });
            
        } catch (error) {
            console.error('YouTube audio error:', error);
            this.showToast(`Failed to load YouTube audio: ${error.message}`, 'error');
            this.setPlayButtonLoading(false);
        }
    }

    async loadAndPlayAudio(url, onSuccess) {
        return new Promise((resolve, reject) => {
            let hasResolved = false;
            
            const cleanup = () => {
                this.audioPlayer.removeEventListener('canplay', onCanPlay);
                this.audioPlayer.removeEventListener('error', onError);
                this.audioPlayer.removeEventListener('loadstart', onLoadStart);
            };
            
            const onCanPlay = () => {
                if (hasResolved) return;
                cleanup();
                this.audioPlayer.play().then(() => {
                    hasResolved = true;
                    onSuccess();
                    resolve();
                }).catch(error => {
                    hasResolved = true;
                    reject(new Error('Playback failed: ' + error.message));
                });
            };
            
            const onError = () => {
                if (hasResolved) return;
                cleanup();
                hasResolved = true;
                const errorMsg = this.audioPlayer.error ? 
                    `Audio error (code ${this.audioPlayer.error.code})` : 
                    'Audio loading failed';
                reject(new Error(errorMsg));
            };
            
            const onLoadStart = () => {
                console.log('Audio loading started...');
            };
            
            this.audioPlayer.addEventListener('canplay', onCanPlay);
            this.audioPlayer.addEventListener('error', onError);
            this.audioPlayer.addEventListener('loadstart', onLoadStart);
            
            this.audioPlayer.src = url;
            this.audioPlayer.load();
            
            // Timeout after 30 seconds
            setTimeout(() => {
                if (!hasResolved) {
                    cleanup();
                    hasResolved = true;
                    reject(new Error('Audio loading timeout'));
                }
            }, 30000);
        });
    }

    playLocalFile(filename) {
        const streamUrl = `/stream/${filename}`;
        this.audioPlayer.src = streamUrl;
        this.audioPlayer.load();
        this.audioPlayer.play();
        
        this.updateNowPlaying(
            filename.replace('.mp3', ''),
            'Local File',
            this.getLocalFileThumbnail()
        );

        this.emitControlAction('play', { 
            source: 'local',
            file: filename 
        });
    }

    // Player Control Methods
    togglePlayPause() {
        if (!this.audioPlayer.src) {
            this.showToast('No audio loaded', 'warning');
            return;
        }

        if (this.audioPlayer.paused) {
            this.audioPlayer.play();
            this.emitControlAction('play');
        } else {
            this.audioPlayer.pause();
            this.emitControlAction('pause');
        }
    }

    seekToPosition(event) {
        if (!this.audioPlayer.duration) return;
        
        const rect = this.progressBar.getBoundingClientRect();
        const pos = (event.clientX - rect.left) / rect.width;
        this.audioPlayer.currentTime = pos * this.audioPlayer.duration;
    }

    updateVolume() {
        const volume = this.volumeSlider.value / 100;
        this.audioPlayer.volume = volume;
        this.updateVolumeIcon();
        localStorage.setItem('musicstream_volume', volume);
    }

    toggleMute() {
        this.audioPlayer.muted = !this.audioPlayer.muted;
        this.updateVolumeIcon();
    }

    updateVolumeIcon() {
        const icon = this.muteBtn?.querySelector('i');
        if (!icon) return;

        if (this.audioPlayer.muted || this.audioPlayer.volume === 0) {
            icon.className = 'fas fa-volume-mute';
        } else if (this.audioPlayer.volume < 0.5) {
            icon.className = 'fas fa-volume-down';
        } else {
            icon.className = 'fas fa-volume-up';
        }
    }

    toggleShuffle() {
        // Placeholder for shuffle functionality
        this.showToast('Shuffle feature coming soon!', 'info');
    }

    playPrevious() {
        // Placeholder for previous track functionality
        this.showToast('Previous track feature coming soon!', 'info');
    }

    playNext() {
        // Placeholder for next track functionality
        this.showToast('Next track feature coming soon!', 'info');
    }

    toggleRepeat() {
        // Placeholder for repeat functionality
        this.showToast('Repeat feature coming soon!', 'info');
    }

    // Audio Event Handlers
    onAudioPlay() {
        this.setPlayButtonIcon('pause');
    }

    onAudioPause() {
        this.setPlayButtonIcon('play');
    }

    onTimeUpdate() {
        if (this.audioPlayer.duration) {
            const progress = (this.audioPlayer.currentTime / this.audioPlayer.duration) * 100;
            this.progressFill.style.width = progress + '%';
            this.currentTimeDisplay.textContent = this.formatTime(this.audioPlayer.currentTime);
        }
    }

    onMetadataLoaded() {
        this.totalTimeDisplay.textContent = this.formatTime(this.audioPlayer.duration);
    }

    onAudioEnded() {
        this.setPlayButtonIcon('play');
        // Auto-play next track in future
    }

    onAudioError(error) {
        console.error('Audio error:', error);
        this.showToast('Audio playback error', 'error');
        this.setPlayButtonLoading(false);
    }

    onLoadStart() {
        console.log('Audio loading started');
    }

    onCanPlay() {
        this.setPlayButtonLoading(false);
    }

    // UI Update Methods
    updateNowPlaying(title, artist, thumbnail) {
        if (this.nowPlayingTitle) this.nowPlayingTitle.textContent = title;
        if (this.nowPlayingArtist) this.nowPlayingArtist.textContent = artist;
        if (this.nowPlayingThumbnail) this.nowPlayingThumbnail.src = thumbnail;
    }

    setPlayButtonIcon(type) {
        const icon = this.playPauseBtn?.querySelector('i');
        if (!icon) return;
        
        icon.className = type === 'play' ? 'fas fa-play' : 'fas fa-pause';
    }

    setPlayButtonLoading(loading) {
        const icon = this.playPauseBtn?.querySelector('i');
        if (!icon) return;
        
        icon.className = loading ? 'fas fa-spinner fa-spin' : 'fas fa-play';
    }

    // Socket.IO Methods
    emitControlAction(action, data = {}) {
        this.socket.emit('control', { action, ...data });
    }

    handleSocketControl(data) {
        if (data.source === 'youtube' && data.videoId) {
            if (data.action === 'play') {
                this.updateNowPlaying(data.title, data.channel, data.thumbnail);
                const expectedStreamUrl = `/youtube/stream/${data.videoId}`;
                
                if (this.audioPlayer.src !== expectedStreamUrl && !this.audioPlayer.src.includes(data.videoId)) {
                    this.playYouTubeAudio(data.videoId, data.title, data.channel, data.thumbnail);
                } else if (this.audioPlayer.paused) {
                    this.audioPlayer.play();
                }
            }
        } else if (data.source === 'local' && data.file) {
            if (data.action === 'play') {
                if (this.audioPlayer.src !== `/stream/${data.file}`) {
                    this.playLocalFile(data.file);
                } else if (this.audioPlayer.paused) {
                    this.audioPlayer.play();
                }
            }
        }
        
        // Handle play/pause for any source
        if (data.action === 'play' && this.audioPlayer.paused) {
            this.audioPlayer.play();
        } else if (data.action === 'pause' && !this.audioPlayer.paused) {
            this.audioPlayer.pause();
        }
    }

    // Event Listeners
    attachVideoCardListeners() {
        document.querySelectorAll('.video-card[data-type="youtube"]').forEach(card => {
            card.addEventListener('click', () => {
                const videoId = card.dataset.videoId;
                const title = card.querySelector('.video-title')?.textContent || 'Unknown';
                const channel = card.querySelector('.video-channel')?.textContent || 'Unknown';
                const thumbnail = card.querySelector('.video-thumbnail')?.src || '';
                
                this.playYouTubeAudio(videoId, title, channel, thumbnail);
            });
        });
    }

    attachFileItemListeners() {
        document.querySelectorAll('.file-item[data-type="local"]').forEach(item => {
            item.addEventListener('click', () => {
                const filename = item.dataset.file;
                this.playLocalFile(filename);
            });
        });
    }

    // Keyboard Shortcuts
    handleKeyboardShortcuts(event) {
        // Prevent shortcuts when typing in search
        if (event.target === this.searchInput) return;

        switch (event.code) {
            case 'Space':
                event.preventDefault();
                this.togglePlayPause();
                break;
            case 'ArrowLeft':
                if (event.ctrlKey) {
                    event.preventDefault();
                    this.audioPlayer.currentTime -= 10;
                }
                break;
            case 'ArrowRight':
                if (event.ctrlKey) {
                    event.preventDefault();
                    this.audioPlayer.currentTime += 10;
                }
                break;
            case 'ArrowUp':
                if (event.ctrlKey) {
                    event.preventDefault();
                    this.volumeSlider.value = Math.min(100, parseInt(this.volumeSlider.value) + 10);
                    this.updateVolume();
                }
                break;
            case 'ArrowDown':
                if (event.ctrlKey) {
                    event.preventDefault();
                    this.volumeSlider.value = Math.max(0, parseInt(this.volumeSlider.value) - 10);
                    this.updateVolume();
                }
                break;
            case 'KeyM':
                if (event.ctrlKey) {
                    event.preventDefault();
                    this.toggleMute();
                }
                break;
        }
    }

    // HTML Template Methods
    createLoadingHTML(message) {
        return `
            <div class="loading">
                <i class="fas fa-spinner fa-spin"></i>
                ${message}
            </div>
        `;
    }

    createErrorHTML(message) {
        return `<div class="error">${message}</div>`;
    }

    createEmptyStateHTML(icon, title, message) {
        return `
            <div class="empty-state">
                <i class="fas fa-${icon}"></i>
                <h3>${title}</h3>
                <p>${message}</p>
            </div>
        `;
    }

    createVideoGridHTML(videos) {
        return `
            <div class="video-grid">
                ${videos.map(video => `
                    <div class="video-card" data-video-id="${video.id}" data-type="youtube">
                        <img class="video-thumbnail" src="${video.thumbnail}" alt="${video.title}" loading="lazy">
                        <div class="video-info">
                            <div class="video-title">${this.escapeHtml(video.title)}</div>
                            <div class="video-channel">${this.escapeHtml(video.channel)}</div>
                            <div class="video-description">${this.escapeHtml(video.description)}</div>
                        </div>
                    </div>
                `).join('')}
            </div>
        `;
    }

    createFileItemHTML(file) {
        return `
            <div class="file-item" data-file="${file}" data-type="local">
                <i class="fas fa-music"></i>
                <span>${this.escapeHtml(file.replace('.mp3', ''))}</span>
            </div>
        `;
    }

    createPlaylistCardHTML(playlist) {
        return `
            <div class="video-card">
                <div style="height: 200px; background: linear-gradient(45deg, var(--primary-color), var(--secondary-color)); display: flex; align-items: center; justify-content: center; color: white; font-size: 48px;">
                    <i class="fas fa-list"></i>
                </div>
                <div class="video-info">
                    <div class="video-title">${this.escapeHtml(playlist.name)}</div>
                    <div class="video-channel">${playlist.count} songs</div>
                </div>
            </div>
        `;
    }

    // Utility Methods
    formatTime(seconds) {
        if (isNaN(seconds) || seconds < 0) return '0:00';
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    getLocalFileThumbnail() {
        return 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="70" height="70" viewBox="0 0 70 70"%3E%3Crect width="70" height="70" fill="%23667eea" rx="8"/%3E%3Ctext x="35" y="42" text-anchor="middle" fill="white" font-family="Arial" font-size="24"%3E♪%3C/text%3E%3C/svg%3E';
    }

    showToast(message, type = 'info') {
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.textContent = message;
        
        document.body.appendChild(toast);
        
        // Trigger animation
        setTimeout(() => toast.classList.add('show'), 10);
        
        // Remove toast after 3 seconds
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => {
                if (document.body.contains(toast)) {
                    document.body.removeChild(toast);
                }
            }, 300);
        }, 3000);
    }

    // Initialize saved settings
    loadSavedSettings() {
        const savedVolume = localStorage.getItem('musicstream_volume');
        if (savedVolume && this.volumeSlider) {
            this.volumeSlider.value = parseFloat(savedVolume) * 100;
            this.audioPlayer.volume = parseFloat(savedVolume);
        }
    }
}

// Initialize the app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.musicApp = new MusicStreamingApp();
    window.musicApp.loadSavedSettings();
});

// Global error handler
window.addEventListener('error', (event) => {
    console.error('Global error:', event.error);
    if (window.musicApp) {
        window.musicApp.showToast('An unexpected error occurred', 'error');
    }
});

// Handle online/offline status
window.addEventListener('online', () => {
    if (window.musicApp) {
        window.musicApp.showToast('Connection restored', 'success');
    }
});

window.addEventListener('offline', () => {
    if (window.musicApp) {
        window.musicApp.showToast('Connection lost', 'warning');
    }
});

// Expose some functions globally for debugging
window.debugMusicApp = {
    showToast: (message, type) => window.musicApp?.showToast(message, type),
    getApp: () => window.musicApp
};