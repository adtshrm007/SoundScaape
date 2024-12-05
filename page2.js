const Input = document.querySelector('.search input');
const SearchBtn = document.querySelector('.fa-solid.fa-magnifying-glass');
const PlayPauseButton = document.querySelector('.fa-solid.fa-play');
const BackButton = document.querySelector('.fa-solid.fa-backward-step');
const ForwardButton = document.querySelector('.fa-solid.fa-forward-step');
const FooterImg = document.querySelector('.FooterImg');
const FooterSongName = document.querySelector('.footer .text p:first-child');
const FooterArtistName = document.querySelector('.footer .text p:last-child');
const ProgressBar = document.querySelector('.progress-bar');
const VolumeBar = document.querySelector('.volume-level');
const VolumeKnob = document.querySelector('.volume-knob');
const PlaylistContainer = document.querySelector('.playlist');
const SongContainer = document.querySelector('.song');
const SongImg = document.querySelector('.song-img img');
const SongName = document.querySelector('.song-text p:first-child');
const ArtistName = document.querySelector('.song-text p:last-child');
const DownloadButton = document.querySelector('.fa-solid.fa-download');
const InitialTime = document.querySelector('.initial-time');
const FinalTime = document.querySelector('.final-time');
const QueueContainer = document.querySelector('.queue');
const TrendingContainer = document.querySelector('.trending-content');
const Queue1 = document.querySelector('.queue-1'); 

const clientId = 'df8a7d7adfd843a58c4d39fb3e4ffb11';
const clientSecret = '48e35d20ef0e4c3488d23d8de94e61a2';
// Update redirectUri to match your deployed URL
const redirectUri = window.location.origin + '/page2.html';

let audio = new Audio();
let isPlaying = false;
let currentTrack = null;
let currentAccessToken = null;
let tokenExpirationTime = 0;
let currentPlaylist = [];
let currentTrackIndex = 0;
let queueStartIndex = 0;

// Format time in MM:SS
const formatTime = (timeInSeconds) => {
    if (isNaN(timeInSeconds)) return '00:00';
    const minutes = Math.floor(timeInSeconds / 60);
    const seconds = Math.floor(timeInSeconds % 60);
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
};

// Load saved state from localStorage
const loadSavedState = () => {
    try {
        const savedVolume = localStorage.getItem('volume');
        if (savedVolume !== null) {
            audio.volume = parseFloat(savedVolume);
            VolumeBar.style.width = `${savedVolume * 100}%`;
        }

        const savedTrack = localStorage.getItem('currentTrack');
        if (savedTrack) {
            const trackData = JSON.parse(savedTrack);
            currentTrack = trackData;
            updateUIWithTrack(trackData);
        }

        const savedPlaylist = localStorage.getItem('currentPlaylist');
        if (savedPlaylist) {
            currentPlaylist = JSON.parse(savedPlaylist);
            currentTrackIndex = parseInt(localStorage.getItem('currentTrackIndex')) || 0;
            queueStartIndex = Math.max(0, currentTrackIndex);
            updateQueueUI();
        }
    } catch (error) {
        console.error('Error loading saved state:', error);
    }
};

// Save state to localStorage
const saveState = () => {
    try {
        localStorage.setItem('volume', audio.volume);
        if (currentTrack) {
            localStorage.setItem('currentTrack', JSON.stringify(currentTrack));
        }
        if (currentPlaylist.length) {
            localStorage.setItem('currentPlaylist', JSON.stringify(currentPlaylist));
            localStorage.setItem('currentTrackIndex', currentTrackIndex);
        }
    } catch (error) {
        console.error('Error saving state:', error);
    }
};

// Initialize GSAP
gsap.registerPlugin(ScrollTrigger);

// Add event listener for track ending
audio.addEventListener('ended', () => {
    playNextTrack();
});

// Add event listener for time update
audio.addEventListener('timeupdate', () => {
    InitialTime.textContent = formatTime(audio.currentTime);
});

// Add event listener for duration change
audio.addEventListener('durationchange', () => {
    FinalTime.textContent = formatTime(audio.duration);
});

const getAccessToken = async () => {
    try {
        const currentTime = Date.now();
        if (currentAccessToken && currentTime < tokenExpirationTime) {
            return currentAccessToken;
        }

        const response = await fetch('https://accounts.spotify.com/api/token', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Authorization': `Basic ${btoa(`${clientId}:${clientSecret}`)}`,
            },
            body: new URLSearchParams({
                grant_type: 'client_credentials'
            })
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        currentAccessToken = data.access_token;
        tokenExpirationTime = currentTime + (data.expires_in * 1000);
        return currentAccessToken;
    } catch (error) {
        console.error('Error getting access token:', error);
        throw error;
    }
};

const getTrendingTracks = async () => {
    try {
        const accessToken = await getAccessToken();
        const response = await fetch(
            `https://api.spotify.com/v1/search?q=language:hindi&type=track&limit=10`, {
                headers: { 'Authorization': `Bearer ${accessToken}` }
            }
        );

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        return data.tracks.items;
    } catch (error) {
        console.error('Error getting trending tracks:', error);
        return [];
    }
};

const displayTrendingTracks = async () => {
    if (!TrendingContainer) return;

    try {
        const trendingTracks = await getTrendingTracks();
        TrendingContainer.innerHTML = '';

        trendingTracks.forEach((track, index) => {
            if (!track || !track.album) return;

            const trackElement = document.createElement('div');
            trackElement.className = 'trending-img';
            trackElement.innerHTML = `
                <img src="${track.album.images[0]?.url || ''}" alt="${track.name}">
                <p>${track.name}</p>
                <p>${track.artists[0]?.name || 'Unknown Artist'}</p>
            `;

            trackElement.addEventListener('click', () => {
                currentPlaylist = trendingTracks;
                currentTrackIndex = index;
                queueStartIndex = Math.max(0, currentTrackIndex);
                playTrack(track);
                saveState();
                updateQueueUI();
            });

            TrendingContainer.appendChild(trackElement);
        });

        // Animate trending tracks
        gsap.from(TrendingContainer.children, {
            opacity: 0,
            y: 50,
            duration: 0.5,
            stagger: 0.1,
            ease: 'power2.out',
            scrollTrigger: {
                trigger: TrendingContainer,
                start: 'top bottom',
                toggleActions: 'play none none reverse'
            }
        });

    } catch (error) {
        console.error('Error displaying trending tracks:', error);
    }
};

const searchTracks = async (query) => {
    if (!query) return [];
    
    try {
        const accessToken = await getAccessToken();
        const response = await fetch(
            `https://api.spotify.com/v1/search?q=${encodeURIComponent(query)}&type=track&limit=10`, {
                headers: { 'Authorization': `Bearer ${accessToken}` }
            }
        );

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        if (!data.tracks || !data.tracks.items) {
            throw new Error('Invalid response format');
        }
        
        currentPlaylist = data.tracks.items;
        currentTrackIndex = 0;
        queueStartIndex = 0;
        saveState();
        updateQueueUI();
        return data.tracks.items;
    } catch (error) {
        console.error('Error searching tracks:', error);
        return [];
    }
};

const displaySearchResults = (tracks) => {
    if (!tracks || !tracks.length) return;

    const container = document.querySelector('.playlist-body');
    if (!container) return;

    container.innerHTML = '<h2>Search Results</h2>';

    const resultsContainer = document.createElement('div');
    resultsContainer.className = 'playlist-genre1';
    
    tracks.forEach((track, index) => {
        if (!track || !track.album) return;

        const trackElement = document.createElement('div');
        trackElement.className = 'playlist-img';
        trackElement.innerHTML = `
            <div class="playlist-img-content">
                <img src="${track.album.images[0]?.url || ''}" alt="${track.name || 'Unknown Track'}">
                <p>${track.name || 'Unknown Track'} - ${track.artists?.[0]?.name || 'Unknown Artist'}</p>
            </div>
        `;

        trackElement.addEventListener('click', () => {
            currentTrackIndex = index;
            queueStartIndex = Math.max(0, currentTrackIndex);
            playTrack(track);
            saveState();
        });

        resultsContainer.appendChild(trackElement);
    });

    container.appendChild(resultsContainer);

    gsap.from(resultsContainer.children, {
        opacity: 0,
        y: 50,
        duration: 0.5,
        stagger: 0.1,
        ease: 'power2.out'
    });
};

const getGenrePlaylists = async (genre, limit = 15) => {
    if (!genre) return [];

    try {
        const accessToken = await getAccessToken();
        const response = await fetch(
            `https://api.spotify.com/v1/search?q=genre:${encodeURIComponent(genre)}&type=playlist&limit=${limit}`, {
                headers: { 'Authorization': `Bearer ${accessToken}` }
            }
        );

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        return data.playlists?.items || [];
    } catch (error) {
        console.error(`Error getting ${genre} playlists:`, error);
        return [];
    }
};

const displayGenrePlaylists = async () => {
    const genres = ['hindi', 'english', 'punjabi', 'chartbuster'];
    const genreContainers = {
        'hindi': document.querySelector('.playlist-genre1'),
        'english': document.querySelector('.playlist-genre2'),
        'punjabi': document.querySelector('.playlist-genre3'),
        'chartbuster': document.querySelector('.playlist-genre4')
    };

    for (const genre of genres) {
        try {
            const playlists = await getGenrePlaylists(genre);
            const container = genreContainers[genre];
            
            if (container && playlists.length) {
                container.innerHTML = '';
                
                playlists.forEach(playlist => {
                    if (!playlist) return;

                    const playlistElement = document.createElement('div');
                    playlistElement.className = 'playlist-img';
                    playlistElement.innerHTML = `
                        <div class="playlist-img-content">
                            <img src="${playlist.images?.[0]?.url || ''}" alt="${playlist.name || 'Unknown Playlist'}">
                            <p>${playlist.name || 'Unknown Playlist'}</p>
                        </div>
                    `;

                    playlistElement.addEventListener('click', () => {
                        if (playlist.id) {
                            showPlaylist(playlist.id);
                        }
                    });

                    container.appendChild(playlistElement);
                });

                gsap.from(container.children, {
                    opacity: 0,
                    y: 50,
                    duration: 0.5,
                    stagger: 0.1,
                    ease: 'power2.out',
                    scrollTrigger: {
                        trigger: container,
                        start: 'top bottom',
                        toggleActions: 'play none none reverse'
                    }
                });
            }
        } catch (error) {
            console.error(`Error displaying ${genre} playlists:`, error);
        }
    }
};

// Initialize playlists and trending tracks when page loads
document.addEventListener('DOMContentLoaded', () => {
    loadSavedState();
    displayGenrePlaylists();
    displayTrendingTracks();
});

const updateQueueUI = () => {
    if (!QueueContainer || !currentPlaylist.length) return;

    const queueContent = document.createElement('div');
    queueContent.innerHTML = '<p>Queue</p>';

    // Show only 10 tracks starting from queueStartIndex
    const endIndex = Math.min(queueStartIndex + 10, currentPlaylist.length);
    for (let i = queueStartIndex; i < endIndex; i++) {
        const track = currentPlaylist[i];
        if (!track || !track.album) continue;

        const queueItem = document.createElement('div');
        queueItem.className = 'queue-1';
        
        // Add "Now Playing" indicator if this is the current track
        const isCurrentTrack = i === currentTrackIndex;
        const nowPlayingIndicator = isCurrentTrack ? '<span class="now-playing"></span>' : '';
        
        queueItem.innerHTML = `
            <div class="queue-img">
                <p>${i + 1}</p>
                <img src="${track.album.images[0]?.url || ''}" alt="${track.name || 'Unknown Track'}">
                <p>${track.name || 'Unknown Track'}</p>
                <p>${track.artists?.[0]?.name || 'Unknown Artist'}</p>
                ${nowPlayingIndicator}
            </div>
        `;

        if (isCurrentTrack) {
            queueItem.classList.add('now-playing');
        }

        queueItem.addEventListener('click', () => {
            currentTrackIndex = i;
            playTrack(track);
            saveState();
        });

        queueContent.appendChild(queueItem);
    }

    QueueContainer.innerHTML = '';
    QueueContainer.appendChild(queueContent);

    gsap.from(QueueContainer.querySelectorAll('.queue-1'), {
        opacity: 0,
        y: 20,
        duration: 0.3,
        stagger: 0.1,
        ease: 'power2.out'
    });
};

const showPlaylist = async (playlistId) => {
    if (!playlistId) return;

    try {
        const accessToken = await getAccessToken();
        const response = await fetch(`https://api.spotify.com/v1/playlists/${playlistId}`, {
            headers: { 'Authorization': `Bearer ${accessToken}` }
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const playlist = await response.json();
        if (playlist.tracks?.items?.length > 0) {
            currentPlaylist = playlist.tracks.items
                .filter(item => item && item.track)
                .map(item => item.track);
            
            if (currentPlaylist.length > 0) {
                currentTrackIndex = 0;
                queueStartIndex = 0;
                updateQueueUI();
                saveState();
                playTrack(currentPlaylist[0]);
            }
        }
    } catch (error) {
        console.error('Error showing playlist:', error);
    }
};

const updateUIWithTrack = (track) => {
    if (!track || !track.album?.images?.[0]?.url) return;

    FooterImg.src = track.album.images[0].url;
    FooterSongName.textContent = track.name || 'Unknown Track';
    FooterArtistName.textContent = track.artists?.[0]?.name || 'Unknown Artist';
    SongImg.src = track.album.images[0].url;
    SongName.textContent = track.name || 'Unknown Track';
    ArtistName.textContent = track.artists?.[0]?.name || 'Unknown Artist';
};

const playTrack = (track) => {
    if (!track || !track.preview_url) return;

    try {
        audio.src = track.preview_url;
        audio.play()
            .then(() => {
                isPlaying = true;
                currentTrack = track;
                
                updateUIWithTrack(track);
                PlayPauseButton.classList.remove('fa-play');
                PlayPauseButton.classList.add('fa-pause');

                gsap.from(SongContainer, {
                    opacity: 0,
                    scale: 0.95,
                    duration: 0.5,
                    ease: 'power2.out'
                });
                
                updateProgressBar();
                updateQueueUI(); // Update queue UI to show new "Now Playing" status
                saveState();
            })
            .catch(error => {
                console.error('Error playing track:', error);
            });
    } catch (error) {
        console.error('Error setting up track:', error);
    }
};

const playNextTrack = () => {
    if (currentPlaylist.length > 0) {
        currentTrackIndex = (currentTrackIndex + 1) % currentPlaylist.length;
        if (currentTrackIndex >= queueStartIndex + 10) {
            queueStartIndex = currentTrackIndex;
            updateQueueUI();
        }
        playTrack(currentPlaylist[currentTrackIndex]);
    }
};

const playPreviousTrack = () => {
    if (currentPlaylist.length > 0) {
        currentTrackIndex = (currentTrackIndex - 1 + currentPlaylist.length) % currentPlaylist.length;
        if (currentTrackIndex < queueStartIndex) {
            queueStartIndex = Math.max(0, currentTrackIndex);
            updateQueueUI();
        }
        playTrack(currentPlaylist[currentTrackIndex]);
    }
};

const updateProgressBar = () => {
    if (audio.duration && !isNaN(audio.duration)) {
        const progress = (audio.currentTime / audio.duration) * 100;
        ProgressBar.style.width = `${progress}%`;
    }
    requestAnimationFrame(updateProgressBar);
};

// Event Listeners
SearchBtn?.addEventListener('click', async () => {
    const query = Input?.value?.trim();
    if (query) {
        const tracks = await searchTracks(query);
        displaySearchResults(tracks);
    }
});

Input?.addEventListener('keypress', async (e) => {
    if (e.key === 'Enter') {
        const query = e.target.value.trim();
        if (query) {
            const tracks = await searchTracks(query);
            displaySearchResults(tracks);
        }
    }
});

PlayPauseButton?.addEventListener('click', () => {
    if (isPlaying) {
        audio.pause();
        PlayPauseButton.classList.remove('fa-pause');
        PlayPauseButton.classList.add('fa-play');
    } else if (currentTrack) {
        audio.play()
            .catch(error => console.error('Error playing audio:', error));
        PlayPauseButton.classList.remove('fa-play');
        PlayPauseButton.classList.add('fa-pause');
    }
    isPlaying = !isPlaying;
});

ForwardButton?.addEventListener('click', playNextTrack);
BackButton?.addEventListener('click', playPreviousTrack);

VolumeBar?.parentElement?.addEventListener('click', (e) => {
    const rect = VolumeBar.parentElement.getBoundingClientRect();
    const volumeLevel = (e.clientX - rect.left) / rect.width;
    audio.volume = Math.max(0, Math.min(1, volumeLevel));
    VolumeBar.style.width = `${volumeLevel * 100}%`;
    saveState();
});

ProgressBar?.parentElement?.addEventListener('click', (e) => {
    if (!audio.duration || isNaN(audio.duration)) return;
    
    const rect = ProgressBar.parentElement.getBoundingClientRect();
    const clickPosition = (e.clientX - rect.left) / rect.width;
    audio.currentTime = clickPosition * audio.duration;
});

// Download functionality
DownloadButton?.addEventListener('click', async () => {
    if (!currentTrack?.preview_url) return;

    try {
        const response = await fetch(currentTrack.preview_url);
        if (!response.ok) throw new Error('Download failed');
        
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${currentTrack.name || 'track'} - ${currentTrack.artists?.[0]?.name || 'unknown'}.mp3`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
    } catch (error) {
        console.error('Error downloading track:', error);
    }
});
